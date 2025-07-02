use super::{
    models::{Metadata, MetadataError},
    service,
};
use crate::app::{books, error::ProsaError, sync, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

pub async fn get_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;

    let metadata_id = match book.metadata_id {
        None => return Err(MetadataError::MetadataNotFound.into()),
        Some(id) => id,
    };

    let metadata = service::get_metadata(&state.pool, &metadata_id).await?;

    Ok(Json(metadata))
}

pub async fn add_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = books::service::get_book(&state.pool, &book_id).await?;
    let sync_id = book.sync_id.clone();

    let metadata_id = match book.metadata_id {
        None => service::add_metadata(&state.pool, metadata).await?,
        Some(_) => return Err(MetadataError::MetadataConflict.into()),
    };

    book.metadata_id = Some(metadata_id);
    books::service::update_book(&state.pool, &book_id, book).await?;

    sync::service::update_metadata_timestamp(&state.pool, &sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn delete_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;

    let metadata_id = match book.metadata_id {
        None => return Err(MetadataError::MetadataNotFound.into()),
        Some(id) => id,
    };

    service::delete_metadata(&state.pool, &metadata_id).await?;

    sync::service::update_metadata_timestamp(&state.pool, &book.sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn patch_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = books::service::get_book(&state.pool, &book_id).await?;
    let sync_id = book.sync_id.clone();

    let metadata_id = match book.metadata_id {
        None => return Err(MetadataError::MetadataNotFound.into()),
        Some(id) => id,
    };

    service::patch_metadata(&state.pool, &metadata_id, metadata).await?;

    // We need to reset the metadata_id because the update temporarily deletes the metadata, which causes the foreign key restriction to set the entry to null
    book.metadata_id = Some(metadata_id);
    books::service::update_book(&state.pool, &book_id, book).await?;

    sync::service::update_metadata_timestamp(&state.pool, &sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn update_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = books::service::get_book(&state.pool, &book_id).await?;
    let sync_id = book.sync_id.clone();

    let metadata_id = match book.metadata_id {
        None => return Err(MetadataError::MetadataNotFound.into()),
        Some(id) => id,
    };

    service::update_metadata(&state.pool, &metadata_id, metadata).await?;

    // We need to reset the metadata_id because the update temporarily deletes the metadata, which causes the foreign key restriction to set the entry to null
    book.metadata_id = Some(metadata_id);
    books::service::update_book(&state.pool, &book_id, book).await?;

    sync::service::update_metadata_timestamp(&state.pool, &sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}
