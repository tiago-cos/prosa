use super::fetcher::MetadataFetcher;
use crate::app::{
    books, covers, epubs,
    error::ProsaError,
    metadata::{
        self,
        models::{Metadata, MetadataError},
    },
    server::LOCKS,
    sync::{
        self,
        models::{ChangeLogAction, ChangeLogEntityType},
    },
};
use log::warn;
use serde::Serialize;
use std::{collections::VecDeque, sync::Arc};
use tokio::sync::{Mutex, Notify, RwLock};

#[derive(Clone, Serialize, PartialEq)]
pub struct MetadataFetcherRequest {
    user_id: String,
    book_id: String,
    providers: Vec<String>,
}

pub struct MetadataFetcherService {
    queue: RwLock<VecDeque<MetadataFetcherRequest>>,
    notify: Notify,
    fetcher: Mutex<MetadataFetcher>,
}

impl MetadataFetcherService {
    pub fn new(epub_extractor_cooldown: u64, goodreads_cooldown: u64) -> Arc<Self> {
        let manager = Self {
            queue: RwLock::new(VecDeque::new()),
            notify: Notify::new(),
            fetcher: Mutex::new(MetadataFetcher::new(epub_extractor_cooldown, goodreads_cooldown)),
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
        let req = MetadataFetcherRequest {
            user_id: user_id.to_string(),
            book_id: book_id.to_string(),
            providers,
        };

        let q = self.queue.read().await;
        if q.contains(&req) {
            return Err(MetadataError::MetadataRequestConflict);
        }
        drop(q);

        let mut q = self.queue.write().await;
        q.push_back(req);
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
            let mut q = self.queue.write().await;
            let req = q.pop_front();
            drop(q);

            let Some(req) = req else {
                self.notify.notified().await;
                continue;
            };

            let (metadata, image) = self.fetch_metadata(&req.book_id, req.providers).await;
            if metadata.is_none() && image.is_none() {
                continue;
            }
            self.store_metadata(&req.book_id, metadata, image).await;
        }
    }

    async fn fetch_metadata(
        &self,
        book_id: &str,
        providers: Vec<String>,
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

        self.fetcher
            .lock()
            .await
            .fetch_metadata(epub_data, providers)
            .await
    }

    async fn store_metadata(&self, book_id: &str, metadata: Option<Metadata>, image: Option<Vec<u8>>) -> () {
        let lock = LOCKS.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let Ok(book) = books::service::get_book(book_id).await else {
            warn!("Background metadata fetching failed for book {book_id}");
            return;
        };

        let metadata_result = match (book.metadata_id, metadata) {
            (_, None) => Ok(()),
            (Some(_), Some(metadata)) => self.handle_metadata_update(book_id, metadata).await,
            (None, Some(metadata)) => self.handle_metadata_create(book_id, metadata).await,
        };

        let cover_result = match (book.cover_id, image) {
            (_, None) => Ok(()),
            (Some(_), Some(image)) => self.handle_cover_update(book_id, image).await,
            (None, Some(image)) => self.handle_cover_create(book_id, image).await,
        };

        if cover_result.is_err() || metadata_result.is_err() {
            warn!("Background metadata fetching failed for book {book_id}");
        }
    }

    async fn handle_metadata_update(&self, book_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
        let book = books::service::get_book(book_id).await?;
        let metadata_id = book.metadata_id.as_ref().expect("Failed to retrieve metadata id");
        metadata::service::update_metadata(metadata_id, metadata).await?;

        sync::service::log_change(
            book_id,
            ChangeLogEntityType::BookMetadata,
            ChangeLogAction::Update,
            &book.owner_id,
            "prosa",
        )
        .await;

        Ok(())
    }

    async fn handle_metadata_create(&self, book_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
        let mut book = books::service::get_book(book_id).await?;
        let metadata_id = metadata::service::add_metadata(metadata).await?;
        book.metadata_id = Some(metadata_id);
        books::service::update_book(book_id, &book).await?;

        sync::service::log_change(
            book_id,
            ChangeLogEntityType::BookMetadata,
            ChangeLogAction::Create,
            &book.owner_id,
            "prosa",
        )
        .await;

        Ok(())
    }

    async fn handle_cover_update(&self, book_id: &str, cover: Vec<u8>) -> Result<(), ProsaError> {
        let mut book = books::service::get_book(book_id).await?;

        let old_cover_id = book.cover_id.expect("Failed to retrieve old cover id");
        let new_cover_id = covers::service::write_cover(&cover).await?;

        book.cover_id = Some(new_cover_id);
        books::service::update_book(book_id, &book).await?;

        if !books::service::cover_is_in_use(&old_cover_id).await {
            covers::service::delete_cover(&old_cover_id).await?;
        }

        sync::service::log_change(
            book_id,
            ChangeLogEntityType::BookCover,
            ChangeLogAction::Update,
            &book.owner_id,
            "prosa",
        )
        .await;

        Ok(())
    }

    async fn handle_cover_create(&self, book_id: &str, cover: Vec<u8>) -> Result<(), ProsaError> {
        let mut book = books::service::get_book(book_id).await?;
        let cover_id = covers::service::write_cover(&cover).await?;
        book.cover_id = Some(cover_id);
        books::service::update_book(book_id, &book).await?;

        sync::service::log_change(
            book_id,
            ChangeLogEntityType::BookCover,
            ChangeLogAction::Create,
            &book.owner_id,
            "prosa",
        )
        .await;

        Ok(())
    }
}
