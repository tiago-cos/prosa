use crate::app::authentication::models::AuthToken;
use crate::app::core::metadata_fetcher::MetadataFetcherRequest;
use crate::app::error::ProsaError;
use crate::app::metadata::models::{Metadata, MetadataError, MetadataFetchRequest};
use crate::app::metadata::service;
use crate::app::server::{LOCKS, METADATA_FETCHER};
use crate::app::sync::models::{ChangeLogAction, ChangeLogEntityType};
use crate::app::users::models::{PreferencesError, VALID_PROVIDERS};
use crate::app::{books, sync, users};
use axum::extract::{Path, Query};
use axum::http::StatusCode;
use axum::{Extension, Json};
use std::collections::HashMap;

pub async fn get_metadata_handler(Path(book_id): Path<String>) -> Result<Json<Metadata>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = books::service::get_book(&book_id).await?;

    let Some(metadata_id) = book.metadata_id else {
        return Err(MetadataError::MetadataNotFound.into());
    };

    let metadata = service::get_metadata(&metadata_id).await?;
    Ok(Json(metadata))
}

pub async fn add_metadata_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = books::service::get_book(&book_id).await?;

    let metadata_id = match book.metadata_id {
        None => service::add_metadata(metadata).await?,
        Some(_) => return Err(MetadataError::MetadataConflict.into()),
    };

    book.metadata_id = Some(metadata_id);
    books::service::update_book(&book_id, &book).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookMetadata,
        ChangeLogAction::Create,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_metadata_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&book_id).await?;

    let Some(metadata_id) = book.metadata_id else {
        return Err(MetadataError::MetadataNotFound.into());
    };

    service::delete_metadata(&metadata_id).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookMetadata,
        ChangeLogAction::Delete,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn patch_metadata_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&book_id).await?;

    let Some(metadata_id) = book.metadata_id else {
        return Err(MetadataError::MetadataNotFound.into());
    };

    service::patch_metadata(&metadata_id, metadata).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookMetadata,
        ChangeLogAction::Update,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_metadata_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&book_id).await?;

    let Some(metadata_id) = book.metadata_id else {
        return Err(MetadataError::MetadataNotFound.into());
    };

    service::update_metadata(&metadata_id, metadata).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookMetadata,
        ChangeLogAction::Update,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn add_metadata_request_handler(
    Json(request): Json<MetadataFetchRequest>,
) -> Result<StatusCode, ProsaError> {
    let book = books::service::get_book(&request.book_id).await?;

    let providers = match request.metadata_providers {
        Some(p) => p,
        None => users::service::get_preferences(&book.owner_id)
            .await?
            .metadata_providers
            .expect("Providers should be present"),
    };

    if !providers.iter().all(|p| VALID_PROVIDERS.contains(&p.as_str())) {
        return Err(PreferencesError::InvalidMetadataProvider.into());
    }

    METADATA_FETCHER
        .enqueue_request(&book.owner_id, &request.book_id, providers)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_metadata_requests_handler(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<MetadataFetcherRequest>>, ProsaError> {
    let user_id = params.get("user_id").map(ToString::to_string);
    let enqueued = METADATA_FETCHER.get_enqueued(user_id).await;

    Ok(Json(enqueued))
}
