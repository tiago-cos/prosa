use super::models::{BookEntity, BookError, UploadBookRequest};
use crate::app::{
    authentication::models::AuthToken,
    books::{
        models::{BookFileMetadataResponse, PaginatedBookResponse},
        service,
    },
    covers::{self},
    epubs,
    error::ProsaError,
    metadata,
    server::{LOCKS, METADATA_FETCHER},
    state,
    sync::{
        self,
        models::{ChangeLogAction, ChangeLogEntityType},
    },
    users,
};
use axum::{
    Extension, Json,
    extract::{Path, Query},
    http::StatusCode,
};
use axum_typed_multipart::TypedMultipart;
use std::collections::HashMap;

pub async fn download_book_handler(Path(book_id): Path<String>) -> Result<Vec<u8>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = service::get_book(&book_id).await?;
    let epub = epubs::service::read_epub(&book.epub_id).await?;

    Ok(epub)
}

pub async fn get_book_file_metadata_handler(
    Path(book_id): Path<String>,
) -> Result<Json<BookFileMetadataResponse>, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = service::get_book(&book_id).await?;
    let file_size = epubs::service::get_file_size(&book.epub_id).await;

    let metadata = BookFileMetadataResponse {
        owner_id: book.owner_id,
        file_size,
    };

    Ok(Json(metadata))
}

pub async fn upload_book_handler(
    Extension(token): Extension<AuthToken>,
    TypedMultipart(data): TypedMultipart<UploadBookRequest>,
) -> Result<String, ProsaError> {
    let owner_id = match data.owner_id.as_deref() {
        Some(id) => id,
        None => token.role.get_user(),
    };

    let preferences = users::service::get_preferences(owner_id).await?;
    let epub_id = epubs::service::write_epub(&data.epub.to_vec()).await?;

    if service::epub_is_in_use_by_user(&epub_id, owner_id).await {
        return Err(BookError::BookConflict.into());
    }

    let state_id = state::service::initialize_state().await;

    let book = BookEntity {
        owner_id: owner_id.to_string(),
        epub_id,
        metadata_id: None,
        cover_id: None,
        state_id,
    };

    let book_id = service::add_book(&book).await?;

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookFile,
        ChangeLogAction::Create,
        owner_id,
        &token.session_id,
    )
    .await;

    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let automatic_metadata = preferences
        .automatic_metadata
        .expect("Metadata preference should be present");

    if automatic_metadata {
        METADATA_FETCHER
            .enqueue_request(
                owner_id,
                &book_id,
                preferences.metadata_providers.unwrap_or(vec![]),
            )
            .await?;
    }

    Ok(book_id)
}

pub async fn search_books_handler(
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<PaginatedBookResponse>, ProsaError> {
    if let Some(username) = params.get("username") {
        users::service::get_user_by_username(username).await?;
    }

    let page = match params.get("page").map(|t| t.parse::<i64>()) {
        Some(Ok(p)) => Some(p),
        None => None,
        _ => return Err(BookError::InvalidPagination.into()),
    };

    let size = match params.get("size").map(|t| t.parse::<i64>()) {
        Some(Ok(s)) => Some(s),
        None => None,
        _ => return Err(BookError::InvalidPagination.into()),
    };

    let books = service::search_books(
        params.get("username").map(ToString::to_string),
        params.get("title").map(ToString::to_string),
        params.get("author").map(ToString::to_string),
        page,
        size,
    )
    .await?;

    Ok(Json(books))
}

pub async fn delete_book_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = service::get_book(&book_id).await?;
    service::delete_book(&book_id).await?;

    if let Some(metadata_id) = book.metadata_id {
        metadata::service::delete_metadata(&metadata_id).await?;
    }

    if !service::epub_is_in_use(&book.epub_id).await {
        epubs::service::delete_epub(&book.epub_id).await?;
    }

    sync::service::log_change(
        &book_id,
        ChangeLogEntityType::BookFile,
        ChangeLogAction::Delete,
        &book.owner_id,
        &token.session_id,
    )
    .await;

    let Some(cover_id) = book.cover_id else {
        return Ok(StatusCode::NO_CONTENT);
    };

    if !service::cover_is_in_use(&cover_id).await {
        covers::service::delete_cover(&cover_id).await?;
    }

    Ok(StatusCode::NO_CONTENT)
}
