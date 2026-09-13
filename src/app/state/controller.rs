use crate::app::{
    authentication::models::AuthToken,
    error::ProsaError,
    server::LOCKS,
    state::{models::State, service},
};
use axum::{Extension, Json, extract::Path, http::StatusCode};

pub async fn get_state_handler(Path(book_id): Path<String>) -> Result<Json<State>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let state = service::get_state(&book_id).await;

    Ok(Json(state))
}

pub async fn patch_state_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    Json(book_state): Json<State>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    service::patch_state(&book_id, book_state, &token.session_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_state_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    Json(book_state): Json<State>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    service::update_state(&book_id, book_state, &token.session_id).await?;

    Ok(StatusCode::NO_CONTENT)
}
