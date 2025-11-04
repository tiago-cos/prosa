use crate::app::books::service::BookService;
use crate::app::error::ProsaError;
use crate::app::metadata::models::{Metadata, MetadataError, MetadataFetchRequest};
use crate::app::metadata::service::MetadataService;
use crate::app::sync::service::SyncService;
use crate::app::users::models::{PreferencesError, VALID_PROVIDERS};
use crate::app::users::service::UserService;
use crate::app::{LockManager, MetadataManager};
use crate::metadata_manager::MetadataRequest;
use axum::Json;
use axum::http::StatusCode;
use std::collections::HashMap;
use std::sync::Arc;

pub struct MetadataController {
    lock_manager: LockManager,
    book_service: Arc<BookService>,
    metadata_service: Arc<MetadataService>,
    metadata_manager: MetadataManager,
    sync_service: Arc<SyncService>,
    user_service: Arc<UserService>,
}

impl MetadataController {
    pub fn new(
        lock_manager: LockManager,
        book_service: Arc<BookService>,
        metadata_service: Arc<MetadataService>,
        metadata_manager: MetadataManager,
        sync_service: Arc<SyncService>,
        user_service: Arc<UserService>,
    ) -> Self {
        Self {
            lock_manager,
            book_service,
            metadata_service,
            metadata_manager,
            sync_service,
            user_service,
        }
    }

    pub async fn get_metadata(&self, book_id: String) -> Result<Json<Metadata>, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;

        let Some(metadata_id) = book.metadata_id else {
            return Err(MetadataError::MetadataNotFound.into());
        };

        let metadata = self.metadata_service.get_metadata(&metadata_id).await?;
        Ok(Json(metadata))
    }

    pub async fn add_metadata(&self, book_id: String, metadata: Metadata) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let mut book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let metadata_id = match book.metadata_id {
            None => self.metadata_service.add_metadata(metadata).await?,
            Some(_) => return Err(MetadataError::MetadataConflict.into()),
        };

        book.metadata_id = Some(metadata_id);
        self.book_service.update_book(&book_id, &book).await?;

        self.sync_service
            .update_book_metadata_timestamp(&book_sync_id)
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn delete_metadata(&self, book_id: String) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;

        let Some(metadata_id) = book.metadata_id else {
            return Err(MetadataError::MetadataNotFound.into());
        };

        self.metadata_service.delete_metadata(&metadata_id).await?;
        self.sync_service
            .update_book_metadata_timestamp(&book.book_sync_id)
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn patch_metadata(
        &self,
        book_id: String,
        metadata: Metadata,
    ) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let Some(metadata_id) = book.metadata_id else {
            return Err(MetadataError::MetadataNotFound.into());
        };

        self.metadata_service
            .patch_metadata(&metadata_id, metadata)
            .await?;
        self.sync_service
            .update_book_metadata_timestamp(&book_sync_id)
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn update_metadata(
        &self,
        book_id: String,
        metadata: Metadata,
    ) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let Some(metadata_id) = book.metadata_id else {
            return Err(MetadataError::MetadataNotFound.into());
        };

        self.metadata_service
            .update_metadata(&metadata_id, metadata)
            .await?;
        self.sync_service
            .update_book_metadata_timestamp(&book_sync_id)
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn add_metadata_request(
        &self,
        request: MetadataFetchRequest,
    ) -> Result<StatusCode, ProsaError> {
        let book = self.book_service.get_book(&request.book_id).await?;

        let providers = match request.metadata_providers {
            Some(p) => p,
            None => self
                .user_service
                .get_preferences(&book.owner_id)
                .await?
                .metadata_providers
                .expect("Providers should be present"),
        };

        if !providers.iter().all(|p| VALID_PROVIDERS.contains(&p.as_str())) {
            return Err(PreferencesError::InvalidMetadataProvider.into());
        }

        self.metadata_manager
            .enqueue_request(&book.owner_id, &request.book_id, providers)
            .await?;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn list_metadata_requests(
        &self,
        query_params: HashMap<String, String>,
    ) -> Result<Json<Vec<MetadataRequest>>, ProsaError> {
        let user_id = query_params.get("user_id").map(ToString::to_string);
        let enqueued = self.metadata_manager.get_enqueued(user_id).await;

        Ok(Json(enqueued))
    }
}
