use super::{models, service};
use crate::app::{books, error::ProsaError, sync, AppState, Pool};
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};

pub async fn get_state_handler(
    State(pool): State<Pool>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let book = books::service::get_book(&pool, &book_id).await?;
    let state = service::get_state(&pool, &book.state_id).await;

    Ok(Json(state))
}

pub async fn patch_state_handler(
    State(app_state): State<AppState>,
    Path(book_id): Path<String>,
    Json(state): Json<models::State>,
) -> Result<impl IntoResponse, ProsaError> {
    let book = books::service::get_book(&app_state.pool, &book_id).await?;
    service::patch_state(
        &app_state.pool,
        &book.state_id,
        &app_state.config.book_storage.epub_path,
        &book.epub_id,
        state,
    )
    .await?;

    sync::service::update_state_timestamp(&app_state.pool, &book.sync_id).await;

    Ok(())
}

pub async fn update_state_handler(
    State(app_state): State<AppState>,
    Path(book_id): Path<String>,
    Json(state): Json<models::State>,
) -> Result<impl IntoResponse, ProsaError> {
    let book = books::service::get_book(&app_state.pool, &book_id).await?;
    service::update_state(
        &app_state.pool,
        &book.state_id,
        &app_state.config.book_storage.epub_path,
        &book.epub_id,
        state,
    )
    .await?;

    sync::service::update_state_timestamp(&app_state.pool, &book.sync_id).await;

    Ok(())
}
