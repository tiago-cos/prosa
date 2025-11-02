use crate::app::{
    LockManager,
    books::service::BookService,
    error::ProsaError,
    state::{models::State, service::StateService},
    sync,
};
use axum::{Json, http::StatusCode};
use sqlx::SqlitePool;
use std::sync::Arc;

pub struct StateController {
    pool: SqlitePool,
    lock_manager: LockManager,
    book_service: Arc<BookService>,
    state_service: Arc<StateService>,
}

impl StateController {
    pub fn new(
        pool: SqlitePool,
        lock_manager: LockManager,
        book_service: Arc<BookService>,
        state_service: Arc<StateService>,
    ) -> Self {
        Self {
            pool,
            lock_manager,
            book_service,
            state_service,
        }
    }

    pub async fn get_state(&self, book_id: String) -> Result<Json<State>, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;
        let state = self.state_service.get_state(&book.state_id).await;

        Ok(Json(state))
    }

    pub async fn patch_state(&self, book_id: String, book_state: State) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;

        self.state_service
            .patch_state(&book.state_id, &book.epub_id, book_state)
            .await?;

        sync::service::update_state_timestamp(&self.pool, &book.book_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn update_state(&self, book_id: String, book_state: State) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;

        self.state_service
            .update_state(&book.state_id, &book.epub_id, book_state)
            .await?;

        sync::service::update_state_timestamp(&self.pool, &book.book_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }
}
