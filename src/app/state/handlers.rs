use super::{models, service};
use crate::app::{books, error::ProsaError, sync, AppState};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

pub async fn get_state_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = books::service::get_book(&state.pool, &book_id).await?;
    let state = service::get_state(&state.pool, &book.state_id).await;

    Ok(Json(state))
}

pub async fn patch_state_handler(
    State(app_state): State<AppState>,
    Path(book_id): Path<String>,
    Json(state): Json<models::State>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = app_state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&app_state.pool, &book_id).await?;
    service::patch_state(
        &app_state.pool,
        &book.state_id,
        &app_state.config.book_storage.epub_path,
        &book.epub_id,
        &app_state.cache.source_cache,
        &app_state.cache.tag_cache,
        state,
    )
    .await?;

    sync::service::update_state_timestamp(&app_state.pool, &book.sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn update_state_handler(
    State(app_state): State<AppState>,
    Path(book_id): Path<String>,
    Json(state): Json<models::State>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = app_state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&app_state.pool, &book_id).await?;
    service::update_state(
        &app_state.pool,
        &book.state_id,
        &app_state.config.book_storage.epub_path,
        &book.epub_id,
        &app_state.cache.source_cache,
        &app_state.cache.tag_cache,
        state,
    )
    .await?;

    sync::service::update_state_timestamp(&app_state.pool, &book.sync_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}
