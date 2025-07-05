use super::fetcher::MetadataFetcher;
use crate::app::{
    books,
    concurrency::manager::BookLockManager,
    covers, epubs,
    error::ProsaError,
    metadata::{self, models::Metadata},
    sync, Config, ImageCache,
};
use log::warn;
use sqlx::SqlitePool;
use std::{collections::VecDeque, sync::Arc};
use tokio::sync::{Mutex, Notify, RwLock};

#[derive(Clone)]
pub struct MetadataRequest {
    user_id: String,
    book_id: String,
    providers: Vec<String>,
}

pub struct MetadataManager {
    fetcher: Mutex<MetadataFetcher>,
    pool: Arc<SqlitePool>,
    lock_manager: Arc<BookLockManager>,
    image_cache: Arc<ImageCache>,
    epub_path: String,
    cover_path: String,
    queue: RwLock<VecDeque<MetadataRequest>>,
    notify: Notify,
}

impl MetadataManager {
    pub fn new(
        pool: Arc<SqlitePool>,
        lock_manager: Arc<BookLockManager>,
        image_cache: Arc<ImageCache>,
        config: &Config,
    ) -> Arc<Self> {
        let manager = Self {
            fetcher: Mutex::new(MetadataFetcher::new(config)),
            pool: pool,
            lock_manager: lock_manager,
            image_cache: image_cache,
            epub_path: config.book_storage.epub_path.clone(),
            cover_path: config.book_storage.cover_path.clone(),
            queue: RwLock::new(VecDeque::new()),
            notify: Notify::new(),
        };
        let manager = Arc::new(manager);

        let worker = manager.clone();
        tokio::spawn(worker.worker_loop());

        manager
    }

    pub async fn enqueue_request(&self, user_id: &str, book_id: &str, providers: Vec<String>) {
        let mut q = self.queue.write().await;
        q.push_back(MetadataRequest {
            user_id: user_id.to_string(),
            book_id: book_id.to_string(),
            providers,
        });
        self.notify.notify_one();
    }

    pub async fn get_enqueued(&self, user_id: Option<String>) -> Vec<MetadataRequest> {
        let q = self.queue.read().await;
        q.iter()
            .filter(|req| user_id.as_ref().map_or(true, |uid| &req.user_id == uid))
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
            self.store_metadata(&req.book_id, metadata, image).await;
        }
    }

    async fn fetch_metadata(
        &self,
        book_id: &str,
        providers: Vec<String>,
    ) -> (Option<Metadata>, Option<Vec<u8>>) {
        let Ok(book) = books::service::get_book(&self.pool, &book_id).await else {
            warn!("Background metadata fetching failed for book {}", book_id);
            return (None, None);
        };
        let Ok(epub_data) = epubs::service::read_epub(&self.epub_path, &book.epub_id).await else {
            warn!("Background metadata fetching failed for book {}", book_id);
            return (None, None);
        };

        self.fetcher
            .lock()
            .await
            .fetch_metadata(epub_data, providers)
            .await
    }

    async fn store_metadata(&self, book_id: &str, metadata: Option<Metadata>, image: Option<Vec<u8>>) -> () {
        let Ok(book) = books::service::get_book(&self.pool, &book_id).await else {
            warn!("Background metadata fetching failed for book {}", book_id);
            return;
        };

        let lock = self.lock_manager.get_lock(&book_id).await;
        let _guard = lock.write().await;

        let metadata_result = match (book.metadata_id, metadata) {
            (_, None) => Ok(()),
            (Some(_), Some(metadata)) => self.handle_metadata_update(&book_id, metadata).await,
            (None, Some(metadata)) => self.handle_metadata_create(&book_id, metadata).await,
        };

        let cover_result = match (book.cover_id, image) {
            (_, None) => Ok(()),
            (Some(_), Some(image)) => self.handle_cover_update(&book_id, image).await,
            (None, Some(image)) => self.handle_cover_create(&book_id, image).await,
        };

        if !cover_result.is_ok() || !metadata_result.is_ok() {
            warn!("Background metadata fetching failed for book {}", book_id);
        }
    }

    async fn handle_metadata_update(&self, book_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
        let book = books::service::get_book(&self.pool, &book_id).await?;
        let metadata_id = book.metadata_id.expect("Failed to retrieve metadata id");
        metadata::service::update_metadata(&self.pool, &metadata_id, metadata).await?;

        sync::service::update_metadata_timestamp(&self.pool, &book.sync_id).await;

        Ok(())
    }

    //TODO in kobont, dont forget to update the book file size endpoint
    async fn handle_metadata_create(&self, book_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
        let mut book = books::service::get_book(&self.pool, &book_id).await?;
        let sync_id = book.sync_id.clone();
        let metadata_id = metadata::service::add_metadata(&self.pool, metadata).await?;
        book.metadata_id = Some(metadata_id);
        books::service::update_book(&self.pool, &book_id, book).await?;

        sync::service::update_metadata_timestamp(&self.pool, &sync_id).await;

        Ok(())
    }

    async fn handle_cover_update(&self, book_id: &str, cover: Vec<u8>) -> Result<(), ProsaError> {
        let mut book = books::service::get_book(&self.pool, &book_id).await?;
        let sync_id = book.sync_id.clone();

        let old_cover_id = book.cover_id.expect("Failed to retrieve old cover id");
        let new_cover_id = covers::service::write_cover(
            &self.pool,
            &self.cover_path,
            &cover,
            &self.lock_manager,
            &self.image_cache,
        )
        .await?;

        book.cover_id = Some(new_cover_id);
        books::service::update_book(&self.pool, &book_id, book).await?;

        if !books::service::cover_is_in_use(&self.pool, &old_cover_id).await {
            covers::service::delete_cover(&self.pool, &self.cover_path, &old_cover_id, &self.image_cache)
                .await?;
        }

        sync::service::update_cover_timestamp(&self.pool, &sync_id).await;

        Ok(())
    }

    async fn handle_cover_create(&self, book_id: &str, cover: Vec<u8>) -> Result<(), ProsaError> {
        let mut book = books::service::get_book(&self.pool, &book_id).await?;
        let sync_id = book.sync_id.clone();
        let cover_id = covers::service::write_cover(
            &self.pool,
            &self.cover_path,
            &cover,
            &self.lock_manager,
            &self.image_cache,
        )
        .await?;
        book.cover_id = Some(cover_id);
        books::service::update_book(&self.pool, &book_id, book).await?;

        sync::service::update_cover_timestamp(&self.pool, &sync_id).await;

        Ok(())
    }
}
