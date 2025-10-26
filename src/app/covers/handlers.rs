use super::{models::CoverError, service};
use crate::app::{AppState, error::ProsaError, sync};
use axum::{
    body::Bytes,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};

pub async fn get_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = state.books.service.get_book(&book_id).await?;
    let cover_path = &state.config.book_storage.cover_path;

    let Some(cover_id) = book.cover_id else {
        return Err(CoverError::CoverNotFound.into());
    };

    let cover = service::read_cover(cover_path, &cover_id, &state.cache.image_cache).await?;

    Ok(cover)
}

pub async fn add_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = state.books.service.get_book(&book_id).await?;
    let cover_path = &state.config.book_storage.cover_path;
    let book_sync_id = book.book_sync_id.clone();

    let cover_id = match book.cover_id {
        None => {
            service::write_cover(
                &state.pool,
                cover_path,
                &cover_data.to_vec(),
                &state.lock_manager,
                &state.cache.image_cache,
            )
            .await?
        }
        Some(_) => return Err(CoverError::CoverConflict.into()),
    };

    book.cover_id = Some(cover_id);
    state.books.service.update_book(&book_id, book).await?;

    sync::service::update_cover_timestamp(&state.pool, &book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn delete_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = state.books.service.get_book(&book_id).await?;
    let cover_path = &state.config.book_storage.cover_path;
    let book_sync_id = book.book_sync_id.clone();

    let Some(cover_id) = book.cover_id else {
        return Err(CoverError::CoverNotFound.into());
    };

    book.cover_id = None;
    state.books.service.update_book(&book_id, book).await?;

    if !state.books.service.cover_is_in_use(&cover_id).await {
        service::delete_cover(&state.pool, cover_path, &cover_id, &state.cache.image_cache).await?;
    }

    sync::service::update_cover_timestamp(&state.pool, &book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn update_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = state.books.service.get_book(&book_id).await?;
    let cover_path = &state.config.book_storage.cover_path;
    let book_sync_id = book.book_sync_id.clone();

    let Some(old_cover_id) = book.cover_id else {
        return Err(CoverError::CoverNotFound.into());
    };

    let new_cover_id = service::write_cover(
        &state.pool,
        cover_path,
        &cover_data.to_vec(),
        &state.lock_manager,
        &state.cache.image_cache,
    )
    .await?;
    book.cover_id = Some(new_cover_id);
    state.books.service.update_book(&book_id, book).await?;

    if !state.books.service.cover_is_in_use(&old_cover_id).await {
        service::delete_cover(&state.pool, cover_path, &old_cover_id, &state.cache.image_cache).await?;
    }

    sync::service::update_cover_timestamp(&state.pool, &book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}
