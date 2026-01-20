use super::models::CoverError;
use crate::app::{
    authentication::models::AuthToken,
    books, covers,
    error::ProsaError,
    server::LOCKS,
    sync::{
        self,
        models::{ChangeLogAction, ChangeLogEntityType},
    },
};
use axum::{Extension, body::Bytes, extract::Path, http::StatusCode};

pub async fn get_cover_handler(Path(book_id): Path<String>) -> Result<Vec<u8>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = books::service::get_book(&book_id).await?;

    let Some(cover_id) = book.cover_id else {
        return Err(CoverError::CoverNotFound.into());
    };

    let cover = covers::service::read_cover(&cover_id).await?;

    Ok(cover)
}

pub async fn add_cover_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = books::service::get_book(&book_id).await?;

    let cover_id = match book.cover_id {
        None => covers::service::write_cover(&cover_data.to_vec()).await?,
        Some(_) => return Err(CoverError::CoverConflict.into()),
    };

    book.cover_id = Some(cover_id);
    books::service::update_book(&book_id, &book).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookCover,
        ChangeLogAction::Create,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_cover_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = books::service::get_book(&book_id).await?;

    let Some(cover_id) = book.cover_id else {
        return Err(CoverError::CoverNotFound.into());
    };

    book.cover_id = None;
    books::service::update_book(&book_id, &book).await?;

    if !books::service::cover_is_in_use(&cover_id).await {
        covers::service::delete_cover(&cover_id).await?;
    }

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookCover,
        ChangeLogAction::Delete,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_cover_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let mut book = books::service::get_book(&book_id).await?;

    let Some(old_cover_id) = book.cover_id else {
        return Err(CoverError::CoverNotFound.into());
    };

    let new_cover_id = covers::service::write_cover(&cover_data.to_vec()).await?;
    book.cover_id = Some(new_cover_id);
    books::service::update_book(&book_id, &book).await?;

    if !books::service::cover_is_in_use(&old_cover_id).await {
        covers::service::delete_cover(&old_cover_id).await?;
    }

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookCover,
        ChangeLogAction::Update,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    Ok(StatusCode::NO_CONTENT)
}
