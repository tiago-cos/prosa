use super::service;
use crate::app::{
    error::ProsaError,
    shelves::models::{AddBookToShelfRequest, CreateShelfRequest, Shelf, ShelfError, UpdateShelfRequest},
    sync, users, AppState, Pool,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;

pub async fn add_shelf_handler(
    State(state): State<AppState>,
    Json(request): Json<CreateShelfRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    // Verify user exists
    users::service::get_user(&state.pool, &request.owner_id).await?;

    if service::get_shelf_by_name_and_owner(&state.pool, &request.name, &request.owner_id)
        .await
        .is_some()
    {
        return Err(ShelfError::ShelfConflict.into());
    }

    let shelf_sync_id = sync::service::initialize_shelf_sync(&state.pool).await;
    let shelf = Shelf {
        name: request.name,
        owner_id: request.owner_id,
        shelf_sync_id,
    };

    let shelf_id = service::add_shelf(&state.pool, shelf).await?;
    Ok(shelf_id)
}

pub async fn get_shelf_metadata_handler(
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_shelf_lock(&shelf_id).await;
    let _guard = lock.read().await;

    let metadata = service::get_shelf_metadata(&state.pool, &shelf_id).await?;

    Ok(Json(metadata))
}

pub async fn update_shelf_handler(
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
    Json(request): Json<UpdateShelfRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_shelf_lock(&shelf_id).await;
    let _guard = lock.write().await;

    let shelf = service::get_shelf(&state.pool, &shelf_id).await?;
    service::update_shelf(&state.pool, &shelf_id, &request.name).await?;

    sync::service::update_shelf_metadata_timestamp(&state.pool, &shelf.shelf_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn delete_shelf_handler(
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_shelf_lock(&shelf_id).await;
    let _guard = lock.write().await;

    let shelf = service::get_shelf(&state.pool, &shelf_id).await?;
    service::delete_shelf(&state.pool, &shelf_id).await?;

    sync::service::update_shelf_delete_timestamp(&state.pool, &shelf.shelf_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn search_shelves_handler(
    State(pool): State<Pool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ProsaError> {
    if let Some(username) = params.get("username") {
        // Verify user exists
        users::service::get_user_by_username(&pool, &username).await?;
    };

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
        &pool,
        params.get("username").map(|s| s.to_string()),
        params.get("name").map(|s| s.to_string()),
        page,
        size,
    )
    .await?;

    Ok(Json(shelves))
}

pub async fn add_book_to_shelf_handler(
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
    Json(request): Json<AddBookToShelfRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let book_lock = state.lock_manager.get_book_lock(&request.book_id).await;
    let _book_guard = book_lock.read().await;
    let shelf_lock = state.lock_manager.get_shelf_lock(&shelf_id).await;
    let _shelf_guard = shelf_lock.write().await;

    let shelf = service::get_shelf(&state.pool, &shelf_id).await?;
    service::add_book_to_shelf(&state.pool, &shelf_id, &request.book_id).await?;
    sync::service::update_shelf_contents_timestamp(&state.pool, &shelf.shelf_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn list_books_in_shelf_handler(
    State(state): State<AppState>,
    Path(shelf_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_shelf_lock(&shelf_id).await;
    let _guard = lock.read().await;

    let books = service::list_shelf_books(&state.pool, &shelf_id).await?;

    Ok(Json(books))
}

pub async fn remove_book_from_shelf_handler(
    State(state): State<AppState>,
    Path((shelf_id, book_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    let book_lock = state.lock_manager.get_book_lock(&book_id).await;
    let _book_guard = book_lock.read().await;
    let shelf_lock = state.lock_manager.get_shelf_lock(&shelf_id).await;
    let _shelf_guard = shelf_lock.write().await;

    let shelf = service::get_shelf(&state.pool, &shelf_id).await?;
    service::delete_book_from_shelf(&state.pool, &shelf_id, &book_id).await?;
    sync::service::update_shelf_contents_timestamp(&state.pool, &shelf.shelf_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}
