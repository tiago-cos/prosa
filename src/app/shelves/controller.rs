use crate::app::core::locking::service::LockService;
use crate::app::shelves::service::ShelfService;
use crate::app::sync::service::SyncService;
use crate::app::users::service::UserService;
use crate::app::{
    authentication::models::AuthToken,
    error::ProsaError,
    shelves::models::{
        AddBookToShelfRequest, CreateShelfRequest, PaginatedShelves, Shelf, ShelfError, ShelfMetadata,
        UpdateShelfRequest,
    },
};
use axum::{Json, http::StatusCode};
use std::{collections::HashMap, sync::Arc};

pub struct ShelfController {
    shelf_service: Arc<ShelfService>,
    lock_service: Arc<LockService>,
    sync_service: Arc<SyncService>,
    user_service: Arc<UserService>,
}

impl ShelfController {
    pub fn new(
        shelf_service: Arc<ShelfService>,
        lock_service: Arc<LockService>,
        sync_service: Arc<SyncService>,
        user_service: Arc<UserService>,
    ) -> Self {
        Self {
            shelf_service,
            lock_service,
            sync_service,
            user_service,
        }
    }

    pub async fn add_shelf(
        &self,
        token: AuthToken,
        request: CreateShelfRequest,
    ) -> Result<String, ProsaError> {
        let owner_id = match request.owner_id.as_deref() {
            Some(id) => id,
            None => token.role.get_user(),
        };

        self.user_service.get_user(owner_id).await?;

        if self
            .shelf_service
            .get_shelf_by_name_and_owner(&request.name, owner_id)
            .await
            .is_some()
        {
            return Err(ShelfError::ShelfConflict.into());
        }

        let shelf_sync_id = self.sync_service.initialize_shelf_sync().await;
        let shelf = Shelf {
            name: request.name,
            owner_id: owner_id.to_string(),
            shelf_sync_id,
        };

        self.shelf_service.add_shelf(shelf).await
    }

    pub async fn get_shelf_metadata(&self, shelf_id: &str) -> Result<Json<ShelfMetadata>, ProsaError> {
        let lock = self.lock_service.get_shelf_lock(shelf_id).await;
        let _guard = lock.read().await;

        let metadata = self.shelf_service.get_shelf_metadata(shelf_id).await?;

        Ok(Json(metadata))
    }

    pub async fn update_shelf(
        &self,
        shelf_id: &str,
        request: UpdateShelfRequest,
    ) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_shelf_lock(shelf_id).await;
        let _guard = lock.write().await;

        let shelf = self.shelf_service.get_shelf(shelf_id).await?;
        self.shelf_service.update_shelf(shelf_id, &request.name).await?;
        self.sync_service
            .update_shelf_metadata_timestamp(&shelf.shelf_sync_id)
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn delete_shelf(&self, shelf_id: &str) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_service.get_shelf_lock(shelf_id).await;
        let _guard = lock.write().await;

        let shelf = self.shelf_service.get_shelf(shelf_id).await?;
        self.shelf_service.delete_shelf(shelf_id).await?;
        self.sync_service
            .update_shelf_delete_timestamp(&shelf.shelf_sync_id)
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn search_shelves(
        &self,
        query_params: HashMap<String, String>,
    ) -> Result<Json<PaginatedShelves>, ProsaError> {
        if let Some(username) = query_params.get("username") {
            self.user_service.get_user_by_username(username).await?;
        }

        let page = query_params.get("page").map(|t| t.parse::<i64>());
        let page = match page {
            Some(Ok(p)) => Some(p),
            None => None,
            _ => return Err(ShelfError::InvalidPagination.into()),
        };

        let size = query_params.get("size").map(|t| t.parse::<i64>());
        let size = match size {
            Some(Ok(s)) => Some(s),
            None => None,
            _ => return Err(ShelfError::InvalidPagination.into()),
        };

        let shelves = self
            .shelf_service
            .search_shelves(
                query_params.get("username").map(ToString::to_string),
                query_params.get("name").map(ToString::to_string),
                page,
                size,
            )
            .await?;

        Ok(Json(shelves))
    }

    pub async fn add_book_to_shelf(
        &self,
        shelf_id: &str,
        request: AddBookToShelfRequest,
    ) -> Result<StatusCode, ProsaError> {
        let book_lock = self.lock_service.get_book_lock(&request.book_id).await;
        let _book_guard = book_lock.read().await;
        let shelf_lock = self.lock_service.get_shelf_lock(shelf_id).await;
        let _shelf_guard = shelf_lock.write().await;

        let shelf = self.shelf_service.get_shelf(shelf_id).await?;
        self.shelf_service
            .add_book_to_shelf(shelf_id, &request.book_id)
            .await?;
        self.sync_service
            .update_shelf_contents_timestamp(&shelf.shelf_sync_id)
            .await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn list_books_in_shelf(&self, shelf_id: &str) -> Result<Json<Vec<String>>, ProsaError> {
        let lock = self.lock_service.get_shelf_lock(shelf_id).await;
        let _guard = lock.read().await;

        let books = self.shelf_service.list_shelf_books(shelf_id).await?;
        Ok(Json(books))
    }

    pub async fn remove_book_from_shelf(
        &self,
        shelf_id: &str,
        book_id: &str,
    ) -> Result<StatusCode, ProsaError> {
        let book_lock = self.lock_service.get_book_lock(book_id).await;
        let _book_guard = book_lock.read().await;
        let shelf_lock = self.lock_service.get_shelf_lock(shelf_id).await;
        let _shelf_guard = shelf_lock.write().await;

        let shelf = self.shelf_service.get_shelf(shelf_id).await?;
        self.shelf_service
            .delete_book_from_shelf(shelf_id, book_id)
            .await?;
        self.sync_service
            .update_shelf_contents_timestamp(&shelf.shelf_sync_id)
            .await;

        Ok(StatusCode::NO_CONTENT)
    }
}
