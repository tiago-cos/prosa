use super::models::CoverError;
use crate::app::{
    Cache, Config, books::service::BookService, concurrency::manager::ProsaLockManager,
    covers::service::CoverService, error::ProsaError, sync,
};
use axum::body::Bytes;
use sqlx::SqlitePool;
use std::sync::Arc;

#[derive(Clone)]
pub struct CoverController {
    pub pool: SqlitePool,
    pub lock_manager: Arc<ProsaLockManager>,
    pub cache: Cache,
    pub config: Config,
    pub book_service: Arc<BookService>,
    pub cover_service: Arc<CoverService>,
}

impl CoverController {
    pub fn new(
        pool: SqlitePool,
        lock_manager: Arc<ProsaLockManager>,
        cache: Cache,
        config: Config,
        book_service: Arc<BookService>,
        cover_service: Arc<CoverService>,
    ) -> Self {
        Self {
            pool,
            lock_manager,
            cache,
            config,
            book_service,
            cover_service,
        }
    }

    pub async fn get_cover(&self, book_id: String) -> Result<Vec<u8>, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;

        let Some(cover_id) = book.cover_id else {
            return Err(CoverError::CoverNotFound.into());
        };

        let cover = self.cover_service.read_cover(&cover_id).await?;

        Ok(cover)
    }

    pub async fn add_cover(&self, book_id: String, cover_data: Bytes) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let mut book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let cover_id = match book.cover_id {
            None => self.cover_service.write_cover(&cover_data.to_vec()).await?,
            Some(_) => return Err(CoverError::CoverConflict.into()),
        };

        book.cover_id = Some(cover_id);
        self.book_service.update_book(&book_id, &book).await?;

        sync::service::update_cover_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }

    pub async fn delete_cover(&self, book_id: String) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let mut book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let Some(cover_id) = book.cover_id else {
            return Err(CoverError::CoverNotFound.into());
        };

        book.cover_id = None;
        self.book_service.update_book(&book_id, &book).await?;

        if !self.book_service.cover_is_in_use(&cover_id).await {
            self.cover_service.delete_cover(&cover_id).await?;
        }

        sync::service::update_cover_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }

    pub async fn update_cover(&self, book_id: String, cover_data: Bytes) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let mut book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let Some(old_cover_id) = book.cover_id else {
            return Err(CoverError::CoverNotFound.into());
        };

        let new_cover_id = self.cover_service.write_cover(&cover_data.to_vec()).await?;
        book.cover_id = Some(new_cover_id);
        self.book_service.update_book(&book_id, &book).await?;

        if !self.book_service.cover_is_in_use(&old_cover_id).await {
            self.cover_service.delete_cover(&old_cover_id).await?;
        }

        sync::service::update_cover_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }
}
