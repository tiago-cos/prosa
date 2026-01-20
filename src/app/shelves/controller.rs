use crate::app::server::LOCKS;
use crate::app::shelves::service;
use crate::app::sync::models::{ChangeLogAction, ChangeLogEntityType};
use crate::app::{
    authentication::models::AuthToken,
    error::ProsaError,
    shelves::models::{
        AddBookToShelfRequest, CreateShelfRequest, PaginatedShelves, Shelf, ShelfError, ShelfMetadata,
        UpdateShelfRequest,
    },
};
use crate::app::{sync, users};
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

    let shelf_id = service::add_shelf(shelf).await?;

    sync::service::log_change(
        &shelf_id,
        ChangeLogEntityType::ShelfMetadata,
        ChangeLogAction::Create,
        owner_id,
        &token.session_id,
    )
    .await;

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

    let shelf = service::get_shelf(&shelf_id).await?;
    service::update_shelf(&shelf_id, &request.name).await?;

    sync::service::log_change(
        &shelf_id,
        ChangeLogEntityType::ShelfMetadata,
        ChangeLogAction::Update,
        &shelf.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_shelf_handler(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_shelf_lock(&shelf_id).await;
    let _guard = lock.write().await;

    let shelf = service::get_shelf(&shelf_id).await?;
    service::delete_shelf(&shelf_id).await?;

    sync::service::log_change(
        &shelf_id,
        ChangeLogEntityType::ShelfMetadata,
        ChangeLogAction::Delete,
        &shelf.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn search_shelves_handler(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<PaginatedShelves>, ProsaError> {
    if let Some(username) = params.get("username") {
        users::service::get_user_by_username(username).await?;
    }

    let page = params.get("page").map(|t| t.parse::<i64>());
    let page = match page {
        Some(Ok(p)) => Some(p),
        None => None,
        _ => return Err(ShelfError::InvalidPagination.into()),
    };

    let size = params.get("size").map(|t| t.parse::<i64>());
    let size = match size {
        Some(Ok(s)) => Some(s),
        None => None,
        _ => return Err(ShelfError::InvalidPagination.into()),
    };

    let shelves = service::search_shelves(
        params.get("username").map(ToString::to_string),
        params.get("name").map(ToString::to_string),
        page,
        size,
    )
    .await?;

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

    let shelf = service::get_shelf(&shelf_id).await?;

    service::add_book_to_shelf(&shelf_id, &request.book_id).await?;

    sync::service::log_change(
        &shelf_id,
        ChangeLogEntityType::ShelfContent,
        ChangeLogAction::Create,
        &shelf.owner_id,
        &token.session_id,
    )
    .await;

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

    let shelf = service::get_shelf(&shelf_id).await?;

    service::delete_book_from_shelf(&shelf_id, &book_id).await?;

    sync::service::log_change(
        &shelf_id,
        ChangeLogEntityType::ShelfContent,
        ChangeLogAction::Delete,
        &shelf.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}
