use super::models::{BookEntity, BookError, UploadBookRequest};
use crate::app::{
    authentication::models::AuthToken,
    books::{
        models::{BookFileMetadataResponse, PaginatedBookResponse},
        service::BookService,
    },
    core::{locking::service::LockService, metadata_fetcher::MetadataFetcherService},
    covers::service::CoverService,
    epubs::service::EpubService,
    error::ProsaError,
    metadata::service::MetadataService,
    state::service::StateService,
    sync::service::SyncService,
    users::service::UserService,
};
use axum::{Json, http::StatusCode};
use std::{collections::HashMap, sync::Arc};

pub struct BookController {
    book_service: Arc<BookService>,
    lock_service: Arc<LockService>,
    metadata_fetcher_service: Arc<MetadataFetcherService>,
    epub_service: Arc<EpubService>,
    cover_service: Arc<CoverService>,
    metadata_service: Arc<MetadataService>,
    state_service: Arc<StateService>,
    sync_service: Arc<SyncService>,
    user_service: Arc<UserService>,
}

impl BookController {
    pub fn new(
        book_service: Arc<BookService>,
        lock_service: Arc<LockService>,
        metadata_fetcher_service: Arc<MetadataFetcherService>,
        epub_service: Arc<EpubService>,
        cover_service: Arc<CoverService>,
        metadata_service: Arc<MetadataService>,
        state_service: Arc<StateService>,
        sync_service: Arc<SyncService>,
        user_service: Arc<UserService>,
    ) -> Self {
        Self {
            book_service,
            lock_service,
            metadata_fetcher_service,
            epub_service,
            cover_service,
            metadata_service,
            state_service,
            sync_service,
            user_service,
        }
    }

    pub async fn download_book(&self, book_id: String) -> Result<Vec<u8>, ProsaError> {
        let lock = self.lock_service.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;
        let epub = self.epub_service.read_epub(&book.epub_id).await?;

        Ok(epub)
    }

    pub async fn get_book_file_metadata(
        &self,
        book_id: String,
    ) -> Result<Json<BookFileMetadataResponse>, ProsaError> {
        let lock = self.lock_service.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;
        let file_size = self.epub_service.get_file_size(&book.epub_id).await;

        let metadata = BookFileMetadataResponse {
            owner_id: book.owner_id,
            file_size,
        };

        Ok(Json(metadata))
    }

    pub async fn upload_book(&self, token: AuthToken, data: UploadBookRequest) -> Result<String, ProsaError> {
        let owner_id = match data.owner_id.as_deref() {
            Some(id) => id,
            None => token.role.get_user(),
        };

        let preferences = self.user_service.get_preferences(owner_id).await?;
        let epub_id = self.epub_service.write_epub(&data.epub.to_vec()).await?;

        if self.book_service.epub_is_in_use_by_user(&epub_id, owner_id).await {
            return Err(BookError::BookConflict.into());
        }

        let state_id = self.state_service.initialize_state().await;
        let book_sync_id = self.sync_service.initialize_book_sync().await;

        let book = BookEntity {
            owner_id: owner_id.to_string(),
            epub_id,
            metadata_id: None,
            cover_id: None,
            state_id,
            book_sync_id,
        };

        let book_id = self.book_service.add_book(&book).await?;

        let lock = self.lock_service.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let automatic_metadata = preferences
            .automatic_metadata
            .expect("Metadata preference should be present");

        if automatic_metadata {
            self.metadata_fetcher_service
                .enqueue_request(
                    owner_id,
                    &book_id,
                    preferences.metadata_providers.unwrap_or(vec![]),
                )
                .await?;
        }

        Ok(book_id)
    }

    pub async fn search_books(
        &self,
        params: HashMap<String, String>,
    ) -> Result<Json<PaginatedBookResponse>, ProsaError> {
        if let Some(username) = params.get("username") {
            self.user_service.get_user_by_username(username).await?;
        }

        let page = match params.get("page").map(|t| t.parse::<i64>()) {
            Some(Ok(p)) => Some(p),
            None => None,
            _ => return Err(BookError::InvalidPagination.into()),
        };

        let size = match params.get("size").map(|t| t.parse::<i64>()) {
            Some(Ok(s)) => Some(s),
            None => None,
            _ => return Err(BookError::InvalidPagination.into()),
        };

        let books = self
            .book_service
            .search_books(
                params.get("username").map(ToString::to_string),
                params.get("title").map(ToString::to_string),
                params.get("author").map(ToString::to_string),
                page,
                size,
            )
            .await?;

        Ok(Json(books))
    }

    //TODO make better tests for syncing, possibly refactor syncing

    pub async fn delete_book(&self, book_id: String) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;
        self.book_service.delete_book(&book_id).await?;

        if let Some(metadata_id) = book.metadata_id {
            self.metadata_service.delete_metadata(&metadata_id).await?;
        }

        if !self.book_service.epub_is_in_use(&book.epub_id).await {
            self.epub_service.delete_epub(&book.epub_id).await?;
        }

        self.sync_service
            .update_book_delete_timestamp(&book.book_sync_id)
            .await;

        let Some(cover_id) = book.cover_id else {
            return Ok(StatusCode::NO_CONTENT);
        };

        if !self.book_service.cover_is_in_use(&cover_id).await {
            self.cover_service.delete_cover(&cover_id).await?;
        }

        Ok(StatusCode::NO_CONTENT)
    }
}
