use crate::app::{
    authentication::models::AuthToken,
    books,
    error::ProsaError,
    server::LOCKS,
    state::{models::State, service},
    sync::{
        self,
        models::{ChangeLogAction, ChangeLogEntityType},
    },
};
use axum::{Extension, Json, extract::Path, http::StatusCode};

pub async fn get_state_handler(Path(book_id): Path<String>) -> Result<Json<State>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = books::service::get_book(&book_id).await?;
    let state = service::get_state(&book.state_id).await;

    Ok(Json(state))
}

pub async fn patch_state_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    Json(book_state): Json<State>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&book_id).await?;

    service::patch_state(&book.state_id, &book.epub_id, book_state).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookState,
        ChangeLogAction::Update,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_state_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    Json(book_state): Json<State>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = books::service::get_book(&book_id).await?;

    service::update_state(&book.state_id, &book.epub_id, book_state).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookState,
        ChangeLogAction::Update,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}
