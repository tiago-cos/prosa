use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;

use crate::app::books::service::BookService;
use crate::app::error::ProsaError;
use crate::app::metadata::models::{Metadata, MetadataError, MetadataFetchRequest};
use crate::app::metadata::service;
use crate::app::users::models::{PreferencesError, VALID_PROVIDERS};
use crate::app::{LockManager, MetadataManager, sync, users};
use crate::metadata_manager::MetadataRequest;

pub struct MetadataController {
    pool: SqlitePool,
    lock_manager: LockManager,
    book_service: Arc<BookService>,
    metadata_manager: MetadataManager,
}

impl MetadataController {
    pub fn new(
        pool: SqlitePool,
        lock_manager: LockManager,
        book_service: Arc<BookService>,
        metadata_manager: MetadataManager,
    ) -> Self {
        Self {
            pool,
            lock_manager,
            book_service,
            metadata_manager,
        }
    }

    pub async fn get_metadata(&self, book_id: String) -> Result<Metadata, ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.read().await;

        let book = self.book_service.get_book(&book_id).await?;

        let Some(metadata_id) = book.metadata_id else {
            return Err(MetadataError::MetadataNotFound.into());
        };

        let metadata = service::get_metadata(&self.pool, &metadata_id).await?;
        Ok(metadata)
    }

    pub async fn add_metadata(&self, book_id: String, metadata: Metadata) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let mut book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let metadata_id = match book.metadata_id {
            None => service::add_metadata(&self.pool, metadata).await?,
            Some(_) => return Err(MetadataError::MetadataConflict.into()),
        };

        book.metadata_id = Some(metadata_id);
        self.book_service.update_book(&book_id, &book).await?;

        sync::service::update_book_metadata_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }

    pub async fn delete_metadata(&self, book_id: String) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;

        let Some(metadata_id) = book.metadata_id else {
            return Err(MetadataError::MetadataNotFound.into());
        };

        service::delete_metadata(&self.pool, &metadata_id).await?;
        sync::service::update_book_metadata_timestamp(&self.pool, &book.book_sync_id).await;

        Ok(())
    }

    pub async fn patch_metadata(&self, book_id: String, metadata: Metadata) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let Some(metadata_id) = book.metadata_id else {
            return Err(MetadataError::MetadataNotFound.into());
        };

        service::patch_metadata(&self.pool, &metadata_id, metadata).await?;
        sync::service::update_book_metadata_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }

    pub async fn update_metadata(&self, book_id: String, metadata: Metadata) -> Result<(), ProsaError> {
        let lock = self.lock_manager.get_book_lock(&book_id).await;
        let _guard = lock.write().await;

        let book = self.book_service.get_book(&book_id).await?;
        let book_sync_id = book.book_sync_id.clone();

        let Some(metadata_id) = book.metadata_id else {
            return Err(MetadataError::MetadataNotFound.into());
        };

        service::update_metadata(&self.pool, &metadata_id, metadata).await?;
        sync::service::update_book_metadata_timestamp(&self.pool, &book_sync_id).await;

        Ok(())
    }

    pub async fn add_metadata_request(&self, request: MetadataFetchRequest) -> Result<(), ProsaError> {
        let book = self.book_service.get_book(&request.book_id).await?;

        let providers = match request.metadata_providers {
            Some(p) => p,
            None => users::service::get_preferences(&self.pool, &book.owner_id)
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

        Ok(())
    }

    pub async fn list_metadata_requests(
        &self,
        query_params: HashMap<String, String>,
    ) -> Result<Vec<MetadataRequest>, ProsaError> {
        let user_id = query_params.get("user_id").map(ToString::to_string);
        let enqueued = self.metadata_manager.get_enqueued(user_id).await;

        Ok(enqueued)
    }
}
