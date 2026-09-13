use super::models::{BookError, UploadBookRequest};
use crate::app::{
    authentication::models::AuthToken,
    books::{
        models::{BookFileMetadataResponse, PaginatedBookResponse},
        service,
    },
    core::pagination::Pagination,
    covers::{self},
    epubs,
    error::ProsaError,
    server::{LOCKS, METADATA_FETCHER},
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
    let book_id = service::resolve_book_id(data.book_id)?;

    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    if service::book_exists(&book_id).await {
        return Err(BookError::BookIdConflict.into());
    }

    let owner_id = token.owner_or_self(data.owner_id.as_deref());

    let preferences = users::service::get_preferences(owner_id).await?;
    let epub_id = epubs::service::write_epub(&data.epub.to_vec()).await?;

    if service::epub_is_in_use_by_user(&epub_id, owner_id).await {
        return Err(BookError::BookConflict.into());
    }

    service::create_book(owner_id, epub_id, &book_id, &token.session_id).await?;

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
    pagination: Pagination,
) -> Result<Json<PaginatedBookResponse>, ProsaError> {
    if let Some(username) = params.get("username") {
        users::service::get_user_by_username(username).await?;
    }

    let books = service::search_books(
        params.get("username").map(ToString::to_string),
        params.get("title").map(ToString::to_string),
        params.get("author").map(ToString::to_string),
        &pagination,
    )
    .await;

    Ok(Json(books))
}

pub async fn delete_book_handler(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    let lock = LOCKS.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let orphaned = service::delete_book_cascade(&book_id, &token.session_id).await?;

    if let Some(epub_id) = orphaned.epub_id {
        epubs::service::remove_epub_file(&epub_id).await?;
    }

    if let Some(cover_id) = orphaned.cover_id {
        covers::service::remove_cover_file(&cover_id).await?;
    }

    Ok(StatusCode::NO_CONTENT)
}
