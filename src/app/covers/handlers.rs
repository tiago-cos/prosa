use super::{models::CoverError, service};
use crate::app::{books, error::ProsaError, sync, AppState};
use axum::{
    body::Bytes,
    extract::{Path, State},
    response::IntoResponse,
};

pub async fn get_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let book = books::service::get_book(&state.pool, &book_id).await?;
    let cover_path = &state.config.book_storage.cover_path;

    let cover_id = match book.cover_id {
        None => return Err(CoverError::CoverNotFound.into()),
        Some(id) => id,
    };

    let cover = service::read_cover(cover_path, &cover_id).await?;

    Ok(cover)
}

pub async fn add_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<impl IntoResponse, ProsaError> {
    let mut book = books::service::get_book(&state.pool, &book_id).await?;
    let cover_path = &state.config.book_storage.cover_path;
    let sync_id = book.sync_id.clone();

    let cover_id = match book.cover_id {
        None => service::write_cover(&state.pool, cover_path, &cover_data.to_vec()).await?,
        Some(_) => return Err(CoverError::CoverConflict.into()),
    };

    book.cover_id = Some(cover_id);
    books::service::update_book(&state.pool, &book_id, book).await?;

    sync::service::update_cover_timestamp(&state.pool, &sync_id).await;

    Ok(())
}

pub async fn delete_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let mut book = books::service::get_book(&state.pool, &book_id).await?;
    let cover_path = &state.config.book_storage.cover_path;
    let sync_id = book.sync_id.clone();

    let cover_id = match book.cover_id {
        None => return Err(CoverError::CoverNotFound.into()),
        Some(id) => id,
    };

    book.cover_id = None;
    books::service::update_book(&state.pool, &book_id, book).await?;

    if !books::service::cover_is_in_use(&state.pool, &cover_id).await {
        service::delete_cover(&state.pool, cover_path, &cover_id).await?;
    }

    sync::service::update_cover_timestamp(&state.pool, &sync_id).await;

    Ok(())
}

pub async fn update_cover_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    cover_data: Bytes,
) -> Result<impl IntoResponse, ProsaError> {
    let mut book = books::service::get_book(&state.pool, &book_id).await?;
    let cover_path = &state.config.book_storage.cover_path;
    let sync_id = book.sync_id.clone();

    let old_cover_id = match book.cover_id {
        None => return Err(CoverError::CoverNotFound.into()),
        Some(id) => id,
    };

    let new_cover_id = service::write_cover(&state.pool, cover_path, &cover_data.to_vec()).await?;
    book.cover_id = Some(new_cover_id);
    books::service::update_book(&state.pool, &book_id, book).await?;

    if !books::service::cover_is_in_use(&state.pool, &old_cover_id).await {
        service::delete_cover(&state.pool, cover_path, &old_cover_id).await?;
    }

    sync::service::update_cover_timestamp(&state.pool, &sync_id).await;

    Ok(())
}
