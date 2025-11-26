use crate::app::{
    authentication::models::AuthToken,
    books::service::BookService,
    core::locking::service::LockService,
    error::ProsaError,
    state::{models::State, service::StateService},
    sync::{
        models::{ChangeLogAction, ChangeLogEntityType},
        service::SyncService,
    },
};
use axum::{Json, http::StatusCode};
use std::sync::Arc;

pub struct StateController {
    lock_service: Arc<LockService>,
    book_service: Arc<BookService>,
    state_service: Arc<StateService>,
    sync_service: Arc<SyncService>,
}

impl StateController {
    pub fn new(
        lock_service: Arc<LockService>,
        book_service: Arc<BookService>,
        state_service: Arc<StateService>,
        sync_service: Arc<SyncService>,
    ) -> Self {
        Self {
            lock_service,
            book_service,
            state_service,
            sync_service,
        }
    }

    pub async fn get_state(&self, book_id: &str) -> Result<Json<State>, ProsaError> {
        let lock = self.lock_service.get_book_lock(book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(book_id).await?;
        let state = self.state_service.get_state(&book.state_id).await;

        Ok(Json(state))
    }

    pub async fn patch_state(
        &self,
        token: AuthToken,
        book_id: &str,
        book_state: State,
    ) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(book_id).await?;

        self.state_service
            .patch_state(&book.state_id, &book.epub_id, book_state)
            .await?;

        self.sync_service
            .log_change(
                book_id,
                ChangeLogEntityType::BookState,
                ChangeLogAction::Update,
                &book.owner_id,
                &token.session_id,
            )
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn update_state(
        &self,
        token: AuthToken,
        book_id: &str,
        book_state: State,
    ) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_book_lock(book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(book_id).await?;

        self.state_service
            .update_state(&book.state_id, &book.epub_id, book_state)
            .await?;

        self.sync_service
            .log_change(
                book_id,
                ChangeLogEntityType::BookState,
                ChangeLogAction::Update,
                &book.owner_id,
                &token.session_id,
            )
            .await;

        Ok(StatusCode::NO_CONTENT)
    }
}
