use crate::app::core::pagination::Pagination;
use crate::app::server::LOCKS;
use crate::app::shelves::service;
use crate::app::users;
use crate::app::{
    authentication::models::AuthToken,
    error::ProsaError,
    shelves::models::{
        AddBookToShelfRequest, CreateShelfRequest, PaginatedShelves, Shelf, ShelfMetadata, UpdateShelfRequest,
    },
};
use axum::Extension;
use axum::extract::{Path, Query};
use axum::{Json, http::StatusCode};
use std::collections::HashMap;

pub async fn add_shelf_handler(
    Extension(token): Extension<AuthToken>,
    Json(request): Json<CreateShelfRequest>,
) -> Result<String, ProsaError> {
    let owner_id = match request.owner_id.as_deref() {
        Some(id) => id,
        None => token.role.get_user(),
    };

    users::service::get_user(owner_id).await?;

    let shelf = Shelf {
        name: request.name,
        owner_id: owner_id.to_string(),
    };

    let shelf_id = service::add_shelf(shelf, request.shelf_id, &token.session_id).await?;

    Ok(shelf_id)
}

pub async fn get_shelf_metadata_handler(
    Path(shelf_id): Path<String>,
) -> Result<Json<ShelfMetadata>, ProsaError> {
    let lock = LOCKS.get_shelf_lock(&shelf_id).await;
    let _guard = lock.read().await;

    let metadata = service::get_shelf_metadata(&shelf_id).await?;

    Ok(Json(metadata))
}

pub async fn update_shelf_handler(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    Json(request): Json<UpdateShelfRequest>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_shelf_lock(&shelf_id).await;
    let _guard = lock.write().await;

    service::update_shelf(&shelf_id, &request.name, &token.session_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_shelf_handler(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_shelf_lock(&shelf_id).await;
    let _guard = lock.write().await;

    service::delete_shelf(&shelf_id, &token.session_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn search_shelves_handler(
    Query(params): Query<HashMap<String, String>>,
    pagination: Pagination,
) -> Result<Json<PaginatedShelves>, ProsaError> {
    if let Some(username) = params.get("username") {
        users::service::get_user_by_username(username).await?;
    }

    let shelves = service::search_shelves(
        params.get("username").map(ToString::to_string),
        params.get("name").map(ToString::to_string),
        &pagination,
    )
    .await;

    Ok(Json(shelves))
}

pub async fn add_book_to_shelf_handler(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    Json(request): Json<AddBookToShelfRequest>,
) -> Result<StatusCode, ProsaError> {
    let book_lock = LOCKS.get_book_lock(&request.book_id).await;
    let _book_guard = book_lock.read().await;
    let shelf_lock = LOCKS.get_shelf_lock(&shelf_id).await;
    let _shelf_guard = shelf_lock.write().await;

    service::add_book_to_shelf(&shelf_id, &request.book_id, &token.session_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_books_in_shelf_handler(
    Path(shelf_id): Path<String>,
) -> Result<Json<Vec<String>>, ProsaError> {
    let lock = LOCKS.get_shelf_lock(&shelf_id).await;
    let _guard = lock.read().await;

    let books = service::list_shelf_books(&shelf_id).await?;
    Ok(Json(books))
}

pub async fn remove_book_from_shelf_handler(
    Extension(token): Extension<AuthToken>,
    Path((shelf_id, book_id)): Path<(String, String)>,
) -> Result<StatusCode, ProsaError> {
    let book_lock = LOCKS.get_book_lock(&book_id).await;
    let _book_guard = book_lock.read().await;
    let shelf_lock = LOCKS.get_shelf_lock(&shelf_id).await;
    let _shelf_guard = shelf_lock.write().await;

    service::delete_book_from_shelf(&shelf_id, &book_id, &token.session_id).await?;

    Ok(StatusCode::NO_CONTENT)
}
