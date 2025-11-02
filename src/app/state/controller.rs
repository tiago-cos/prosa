use crate::app::{
    Cache, LockManager,
    books::service::BookService,
    error::ProsaError,
    state::{models::State, service},
    sync,
};
use axum::{Json, http::StatusCode};
use sqlx::SqlitePool;
use std::sync::Arc;

pub struct StateController {
    pool: SqlitePool,
    lock_manager: LockManager,
    book_service: Arc<BookService>,
    epub_path: String,
    cache: Cache,
}

impl StateController {
    pub fn new(
        pool: SqlitePool,
        lock_manager: LockManager,
        book_service: Arc<BookService>,
        epub_path: String,
        cache: Cache,
    ) -> Self {
        Self {
            pool,
            lock_manager,
            book_service,
            epub_path,
            cache,
        }
    }

    pub async fn get_state(&self, book_id: String) -> Result<Json<State>, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;
        let state = service::get_state(&self.pool, &book.state_id).await;

        Ok(Json(state))
    }

    pub async fn patch_state(&self, book_id: String, book_state: State) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;

        service::patch_state(
            &self.pool,
            &book.state_id,
            &self.epub_path,
            &book.epub_id,
            &self.cache.source_cache,
            &self.cache.tag_cache,
            book_state,
        )
        .await?;

        sync::service::update_state_timestamp(&self.pool, &book.book_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn update_state(&self, book_id: String, book_state: State) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;

        service::update_state(
            &self.pool,
            &book.state_id,
            &self.epub_path,
            &book.epub_id,
            &self.cache.source_cache,
            &self.cache.tag_cache,
            book_state,
        )
        .await?;

        sync::service::update_state_timestamp(&self.pool, &book.book_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }
}
