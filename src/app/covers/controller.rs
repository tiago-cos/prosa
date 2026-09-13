use crate::app::{authentication::models::AuthToken, books, error::ProsaError, server::LOCKS};
use axum::{Extension, body::Bytes, extract::Path, http::StatusCode};

pub async fn get_cover_handler(Path(book_id): Path<String>) -> Result<Vec<u8>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let cover = books::service::get_cover(&book_id).await?;

    Ok(cover)
}

pub async fn add_cover_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    books::service::attach_cover(&book_id, &cover_data, &token.session_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_cover_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    books::service::detach_cover(&book_id, &token.session_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_cover_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    books::service::replace_cover(&book_id, &cover_data, &token.session_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
