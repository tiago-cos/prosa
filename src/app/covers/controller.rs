use super::models::CoverError;
use crate::app::{
    books::service::BookService, core::locking::service::LockService, covers::service::CoverService,
    error::ProsaError, sync::service::SyncService,
};
use axum::{body::Bytes, http::StatusCode};
use std::sync::Arc;

pub struct CoverController {
    lock_service: Arc<LockService>,
    book_service: Arc<BookService>,
    cover_service: Arc<CoverService>,
    sync_service: Arc<SyncService>,
}

impl CoverController {
    pub fn new(
        lock_service: Arc<LockService>,
        book_service: Arc<BookService>,
        cover_service: Arc<CoverService>,
        sync_service: Arc<SyncService>,
    ) -> Self {
        Self {
            lock_service,
            book_service,
            cover_service,
            sync_service,
        }
    }

    pub async fn get_cover(&self, book_id: String) -> Result<Vec<u8>, ProsaError> {
        let lock = self.lock_service.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;

        let Some(cover_id) = book.cover_id else {
            return Err(CoverError::CoverNotFound.into());
        };

        let cover = self.cover_service.read_cover(&cover_id).await?;

        Ok(cover)
    }

    pub async fn add_cover(&self, book_id: String, cover_data: Bytes) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let mut book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let cover_id = match book.cover_id {
            None => self.cover_service.write_cover(&cover_data.to_vec()).await?,
            Some(_) => return Err(CoverError::CoverConflict.into()),
        };

        book.cover_id = Some(cover_id);
        self.book_service.update_book(&book_id, &book).await?;

        self.sync_service.update_cover_timestamp(&book_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn delete_cover(&self, book_id: String) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_book_lock(&book_id).await;
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

        self.sync_service.update_cover_timestamp(&book_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn update_cover(&self, book_id: String, cover_data: Bytes) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_book_lock(&book_id).await;
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

        self.sync_service.update_cover_timestamp(&book_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }
}
