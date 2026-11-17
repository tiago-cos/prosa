use super::fetcher::MetadataFetcher;
use crate::app::{
    books, epubs,
    metadata::{
        self,
        models::{Metadata, MetadataError},
    },
    server::LOCKS,
    users,
};
use log::warn;
use serde::Serialize;
use std::{collections::VecDeque, sync::Arc};
use tokio::sync::{Notify, RwLock};

const SESSION: &str = "prosa";

#[derive(Clone, Copy, Serialize, PartialEq, Eq)]
pub enum MetadataRequestStatus {
    Waiting,
    InProgress,
}

#[derive(Clone, Serialize)]
pub struct MetadataFetcherRequest {
    user_id: String,
    book_id: String,
    providers: Vec<String>,
    status: MetadataRequestStatus,
}

impl MetadataFetcherRequest {
    fn is_same_request(&self, user_id: &str, book_id: &str, providers: &[String]) -> bool {
        self.user_id == user_id && self.book_id == book_id && self.providers == providers
    }
}

pub struct MetadataFetcherService {
    queue: RwLock<VecDeque<MetadataFetcherRequest>>,
    notify: Notify,
    fetcher: MetadataFetcher,
}

impl MetadataFetcherService {
    pub fn new() -> Arc<Self> {
        let manager = Self {
            queue: RwLock::new(VecDeque::new()),
            notify: Notify::new(),
            fetcher: MetadataFetcher::new(),
        };

        let manager = Arc::new(manager);
        let worker = manager.clone();
        tokio::spawn(worker.worker_loop());

        manager
    }

    pub async fn enqueue_request(
        &self,
        user_id: &str,
        book_id: &str,
        providers: Vec<String>,
    ) -> Result<(), MetadataError> {
        let mut q = self.queue.write().await;
        let duplicate = q.iter().any(|req| {
            req.status == MetadataRequestStatus::Waiting && req.is_same_request(user_id, book_id, &providers)
        });
        if duplicate {
            return Err(MetadataError::MetadataRequestConflict);
        }

        q.push_back(MetadataFetcherRequest {
            user_id: user_id.to_string(),
            book_id: book_id.to_string(),
            providers,
            status: MetadataRequestStatus::Waiting,
        });
        drop(q);
        self.notify.notify_one();

        Ok(())
    }

    pub async fn get_enqueued(&self, user_id: Option<String>) -> Vec<MetadataFetcherRequest> {
        let q = self.queue.read().await;
        q.iter()
            .filter(|req| user_id.as_ref().is_none_or(|uid| &req.user_id == uid))
            .cloned()
            .collect()
    }

    async fn worker_loop(self: Arc<Self>) {
        loop {
            let Some(req) = self.start_next().await else {
                self.notify.notified().await;
                continue;
            };

            let (metadata, image) = self
                .fetch_metadata(&req.user_id, &req.book_id, &req.providers)
                .await;
            if metadata.is_some() || image.is_some() {
                self.store_metadata(&req.book_id, metadata, image).await;
            }

            self.finish_current().await;
        }
    }

    async fn start_next(&self) -> Option<MetadataFetcherRequest> {
        let mut q = self.queue.write().await;
        let req = q
            .iter_mut()
            .find(|req| req.status == MetadataRequestStatus::Waiting)?;
        req.status = MetadataRequestStatus::InProgress;
        let req = req.clone();
        drop(q);
        Some(req)
    }

    async fn finish_current(&self) {
        let mut q = self.queue.write().await;
        if let Some(index) = q
            .iter()
            .position(|req| req.status == MetadataRequestStatus::InProgress)
        {
            q.remove(index);
        }
    }

    async fn fetch_metadata(
        &self,
        user_id: &str,
        book_id: &str,
        providers: &[String],
    ) -> (Option<Metadata>, Option<Vec<u8>>) {
        let lock = LOCKS.get_book_lock(book_id).await;
        let _guard = lock.read().await;

        let Ok(book) = books::service::get_book(book_id).await else {
            warn!("Background metadata fetching failed for book {book_id}");
            return (None, None);
        };

        let Ok(epub_data) = epubs::service::read_epub(&book.epub_id).await else {
            warn!("Background metadata fetching failed for book {book_id}");
            return (None, None);
        };

        let Ok(providers) = users::service::get_provider_keys(user_id, providers).await else {
            warn!("Background metadata fetching failed for book {book_id}");
            return (None, None);
        };

        self.fetcher.fetch_metadata(&epub_data, &providers).await
    }

    async fn store_metadata(&self, book_id: &str, metadata: Option<Metadata>, image: Option<Vec<u8>>) {
        let lock = LOCKS.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let metadata_result = match metadata {
            None => Ok(()),
            Some(metadata) => metadata::service::store_metadata(book_id, metadata, SESSION).await,
        };

        let cover_result = match image {
            None => Ok(()),
            Some(image) => books::service::set_cover(book_id, &image, SESSION).await,
        };

        if cover_result.is_err() || metadata_result.is_err() {
            warn!("Background metadata fetching failed for book {book_id}");
        }
    }
}
