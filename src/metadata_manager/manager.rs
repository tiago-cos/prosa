use super::fetcher::MetadataFetcher;
use crate::app::{
    Config,
    books::service::BookService,
    concurrency::manager::ProsaLockManager,
    covers::service::CoverService,
    epubs::service::EpubService,
    error::ProsaError,
    metadata::{
        self,
        models::{Metadata, MetadataError},
    },
    sync,
};
use log::warn;
use serde::Serialize;
use sqlx::SqlitePool;
use std::{collections::VecDeque, sync::Arc};
use tokio::sync::{Mutex, Notify, RwLock};

#[derive(Clone, Serialize, PartialEq)]
pub struct MetadataRequest {
    user_id: String,
    book_id: String,
    providers: Vec<String>,
}

pub struct MetadataManager {
    fetcher: Mutex<MetadataFetcher>,
    books: Arc<BookService>,
    pool: SqlitePool,
    lock_manager: Arc<ProsaLockManager>,
    queue: RwLock<VecDeque<MetadataRequest>>,
    notify: Notify,
    epub_service: Arc<EpubService>,
    cover_service: Arc<CoverService>,
}

impl MetadataManager {
    pub fn new(
        pool: SqlitePool,
        books: Arc<BookService>,
        lock_manager: Arc<ProsaLockManager>,
        config: &Config,
        epub_service: Arc<EpubService>,
        cover_service: Arc<CoverService>,
    ) -> Arc<Self> {
        let manager = Self {
            fetcher: Mutex::new(MetadataFetcher::new(config)),
            books,
            pool,
            lock_manager,
            queue: RwLock::new(VecDeque::new()),
            notify: Notify::new(),
            epub_service,
            cover_service,
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
        let req = MetadataRequest {
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

    pub async fn get_enqueued(&self, user_id: Option<String>) -> Vec<MetadataRequest> {
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
        let lock = self.lock_manager.get_book_lock(book_id).await;
        let _guard = lock.read().await;

        let Ok(book) = self.books.get_book(book_id).await else {
            warn!("Background metadata fetching failed for book {book_id}");
            return (None, None);
        };
        let Ok(epub_data) = self.epub_service.read_epub(&book.epub_id).await else {
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
        let lock = self.lock_manager.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let Ok(book) = self.books.get_book(book_id).await else {
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
        let book = self.books.get_book(book_id).await?;
        let book_sync_id = book.book_sync_id.clone();
        let metadata_id = book.metadata_id.as_ref().expect("Failed to retrieve metadata id");
        metadata::service::update_metadata(&self.pool, metadata_id, metadata).await?;

        sync::service::update_book_metadata_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }

    async fn handle_metadata_create(&self, book_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
        let mut book = self.books.get_book(book_id).await?;
        let book_sync_id = book.book_sync_id.clone();
        let metadata_id = metadata::service::add_metadata(&self.pool, metadata).await?;
        book.metadata_id = Some(metadata_id);
        self.books.update_book(book_id, &book).await?;

        sync::service::update_book_metadata_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }

    async fn handle_cover_update(&self, book_id: &str, cover: Vec<u8>) -> Result<(), ProsaError> {
        let mut book = self.books.get_book(book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let old_cover_id = book.cover_id.expect("Failed to retrieve old cover id");
        let new_cover_id = self.cover_service.write_cover(&cover).await?;

        book.cover_id = Some(new_cover_id);
        self.books.update_book(book_id, &book).await?;

        if !self.books.cover_is_in_use(&old_cover_id).await {
            self.cover_service.delete_cover(&old_cover_id).await?;
        }

        sync::service::update_cover_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }

    async fn handle_cover_create(&self, book_id: &str, cover: Vec<u8>) -> Result<(), ProsaError> {
        let mut book = self.books.get_book(book_id).await?;
        let book_sync_id = book.book_sync_id.clone();
        let cover_id = self.cover_service.write_cover(&cover).await?;
        book.cover_id = Some(cover_id);
        self.books.update_book(book_id, &book).await?;

        sync::service::update_cover_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }
}
