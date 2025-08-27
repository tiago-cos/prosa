use super::{
    models::{Metadata, MetadataError},
    service,
};
use crate::app::{
    AppState, books,
    error::ProsaError,
    metadata::models::MetadataFetchRequest,
    sync,
    users::{
        self,
        models::{PreferencesError, VALID_PROVIDERS},
    },
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use std::collections::HashMap;

pub async fn get_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;

    let Some(metadata_id) = book.metadata_id else {
        return Err(MetadataError::MetadataNotFound.into());
    };

    let metadata = service::get_metadata(&state.pool, &metadata_id).await?;

    Ok(Json(metadata))
}

pub async fn add_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = books::service::get_book(&state.pool, &book_id).await?;
    let book_sync_id = book.book_sync_id.clone();

    let metadata_id = match book.metadata_id {
        None => service::add_metadata(&state.pool, metadata).await?,
        Some(_) => return Err(MetadataError::MetadataConflict.into()),
    };

    book.metadata_id = Some(metadata_id);
    books::service::update_book(&state.pool, &book_id, book).await?;

    sync::service::update_book_metadata_timestamp(&state.pool, &book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn delete_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;

    let Some(metadata_id) = book.metadata_id else {
        return Err(MetadataError::MetadataNotFound.into());
    };

    service::delete_metadata(&state.pool, &metadata_id).await?;

    sync::service::update_book_metadata_timestamp(&state.pool, &book.book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn patch_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;
    let book_sync_id = book.book_sync_id.clone();

    let Some(metadata_id) = book.metadata_id else {
        return Err(MetadataError::MetadataNotFound.into());
    };

    service::patch_metadata(&state.pool, &metadata_id, metadata).await?;

    sync::service::update_book_metadata_timestamp(&state.pool, &book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn update_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;
    let book_sync_id = book.book_sync_id.clone();

    let Some(metadata_id) = book.metadata_id else {
        return Err(MetadataError::MetadataNotFound.into());
    };

    service::update_metadata(&state.pool, &metadata_id, metadata).await?;

    sync::service::update_book_metadata_timestamp(&state.pool, &book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn add_metadata_request_handler(
    State(state): State<AppState>,
    Json(request): Json<MetadataFetchRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let book = books::service::get_book(&state.pool, &request.book_id).await?;
    let providers = match request.metadata_providers {
        Some(p) => p,
        None => users::service::get_preferences(&state.pool, &book.owner_id)
            .await?
            .metadata_providers
            .expect("Providers should be present"),
    };

    if !providers.iter().all(|p| VALID_PROVIDERS.contains(&p.as_str())) {
        return Err(PreferencesError::InvalidMetadataProvider.into());
    }

    state
        .metadata_manager
        .enqueue_request(&book.owner_id, &request.book_id, providers)
        .await?;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn list_metadata_requests_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ProsaError> {
    let user_id = params.get("user_id").map(ToString::to_string);
    let enqueued = state.metadata_manager.get_enqueued(user_id).await;

    Ok(Json(enqueued))
}
