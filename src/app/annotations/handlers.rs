use super::{
    models::{NewAnnotationRequest, PatchAnnotationRequest},
    service,
};
use crate::app::{books, error::ProsaError, sync, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

pub async fn add_annotation_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(annotation): Json<NewAnnotationRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;
    let annotation_id = service::add_annotation(
        &state.pool,
        &book_id,
        annotation,
        &state.config.book_storage.epub_path,
        &book.epub_id,
        &state.cache.source_cache,
        &state.cache.tag_cache,
        &state.cache.tag_length_cache,
    )
    .await?;

    sync::service::update_annotations_timestamp(&state.pool, &book.book_sync_id).await;

    Ok(annotation_id)
}

pub async fn get_annotation_handler(
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    books::service::get_book(&state.pool, &book_id).await?;
    let annotation = service::get_annotation(&state.pool, &annotation_id).await?;

    Ok(Json(annotation))
}

pub async fn list_annotation_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    books::service::get_book(&state.pool, &book_id).await?;
    let annotations = service::get_annotations(&state.pool, &book_id).await;

    Ok(Json(annotations))
}

pub async fn delete_annotation_handler(
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;
    service::delete_annotation(&state.pool, &annotation_id).await?;

    sync::service::update_annotations_timestamp(&state.pool, &book.book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn patch_annotation_handler(
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
    Json(request): Json<PatchAnnotationRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;
    service::patch_annotation(&state.pool, &annotation_id, request.note).await?;

    sync::service::update_annotations_timestamp(&state.pool, &book.book_sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}
