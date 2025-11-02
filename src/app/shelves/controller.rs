use crate::app::books::service::BookService;
use crate::app::sync::service as sync_service;
use crate::app::{
    LockManager,
    authentication::models::AuthToken,
    error::ProsaError,
    shelves::{
        models::{
            AddBookToShelfRequest, CreateShelfRequest, PaginatedShelves, Shelf, ShelfError, ShelfMetadata,
            UpdateShelfRequest,
        },
        service,
    },
    sync, users,
};
use axum::{Json, http::StatusCode};
use sqlx::SqlitePool;
use std::{collections::HashMap, sync::Arc};

pub struct ShelfController {
    pub book_service: Arc<BookService>,
    pub lock_manager: LockManager,
    pub pool: SqlitePool,
}

impl ShelfController {
    pub fn new(book_service: Arc<BookService>, lock_manager: LockManager, pool: SqlitePool) -> Self {
        Self {
            book_service,
            lock_manager,
            pool,
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

        users::service::get_user(&self.pool, owner_id).await?;

        //TODO don't forget, can make it so that the route wrapper just calls state, check shelf router
        //TODO this logic should be done is service
        if service::get_shelf_by_name_and_owner(&self.pool, &request.name, owner_id)
            .await
            .is_some()
        {
            return Err(ShelfError::ShelfConflict.into());
        }

        let shelf_sync_id = sync_service::initialize_shelf_sync(&self.pool).await;
        let shelf = Shelf {
            name: request.name,
            owner_id: owner_id.to_string(),
            shelf_sync_id,
        };

        service::add_shelf(&self.pool, shelf).await
    }

    pub async fn get_shelf_metadata(&self, shelf_id: &str) -> Result<Json<ShelfMetadata>, ProsaError> {
        let lock = self.lock_manager.get_shelf_lock(shelf_id).await;
        let _guard = lock.read().await;

        let metadata = service::get_shelf_metadata(&self.pool, shelf_id).await?;

        Ok(Json(metadata))
    }

    pub async fn update_shelf(
        &self,
        shelf_id: &str,
        request: UpdateShelfRequest,
    ) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_shelf_lock(shelf_id).await;
        let _guard = lock.write().await;

        let shelf = service::get_shelf(&self.pool, shelf_id).await?;
        service::update_shelf(&self.pool, shelf_id, &request.name).await?;
        sync_service::update_shelf_metadata_timestamp(&self.pool, &shelf.shelf_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn delete_shelf(&self, shelf_id: &str) -> Result<StatusCode, ProsaError> {
        let lock = self.lock_manager.get_shelf_lock(shelf_id).await;
        let _guard = lock.write().await;

        let shelf = service::get_shelf(&self.pool, shelf_id).await?;
        service::delete_shelf(&self.pool, shelf_id).await?;
        sync_service::update_shelf_delete_timestamp(&self.pool, &shelf.shelf_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn search_shelves(
        &self,
        query_params: HashMap<String, String>,
    ) -> Result<Json<PaginatedShelves>, ProsaError> {
        if let Some(username) = query_params.get("username") {
            users::service::get_user_by_username(&self.pool, username).await?;
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

        let shelves = service::search_shelves(
            &self.pool,
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
        let book_lock = self.lock_manager.get_book_lock(&request.book_id).await;
        let _book_guard = book_lock.read().await;
        let shelf_lock = self.lock_manager.get_shelf_lock(shelf_id).await;
        let _shelf_guard = shelf_lock.write().await;

        let shelf = service::get_shelf(&self.pool, shelf_id).await?;
        service::add_book_to_shelf(&self.book_service, &self.pool, shelf_id, &request.book_id).await?;
        sync::service::update_shelf_contents_timestamp(&self.pool, &shelf.shelf_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }

    pub async fn list_books_in_shelf(&self, shelf_id: &str) -> Result<Json<Vec<String>>, ProsaError> {
        let lock = self.lock_manager.get_shelf_lock(shelf_id).await;
        let _guard = lock.read().await;

        let books = service::list_shelf_books(&self.pool, shelf_id).await?;
        Ok(Json(books))
    }

    pub async fn remove_book_from_shelf(
        &self,
        shelf_id: &str,
        book_id: &str,
    ) -> Result<StatusCode, ProsaError> {
        let book_lock = self.lock_manager.get_book_lock(book_id).await;
        let _book_guard = book_lock.read().await;
        let shelf_lock = self.lock_manager.get_shelf_lock(shelf_id).await;
        let _shelf_guard = shelf_lock.write().await;

        let shelf = service::get_shelf(&self.pool, shelf_id).await?;
        service::delete_book_from_shelf(&self.pool, shelf_id, book_id).await?;
        sync_service::update_shelf_contents_timestamp(&self.pool, &shelf.shelf_sync_id).await;

        Ok(StatusCode::NO_CONTENT)
    }
}
