use super::{
    models::{Book, BookError, UploadBoodRequest},
    service,
};
use crate::app::{
    AppState, Pool, authentication::models::AuthToken, books::models::BookFileMetadata, covers, epubs,
    error::ProsaError, metadata, state, sync, users,
};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use axum_typed_multipart::TypedMultipart;
use std::collections::HashMap;

pub async fn download_book_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = service::get_book(&state.pool, &book_id).await?;
    let epub = epubs::service::read_epub(&state.config.book_storage.epub_path, &book.epub_id).await?;

    Ok(epub)
}

pub async fn get_book_file_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = service::get_book(&state.pool, &book_id).await?;
    let file_size = epubs::service::get_file_size(&state.config.book_storage.epub_path, &book.epub_id).await;

    Ok(Json(BookFileMetadata {
        owner_id: book.owner_id,
        file_size,
    }))
}

pub async fn upload_book_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    TypedMultipart(data): TypedMultipart<UploadBoodRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let owner_id = match data.owner_id.as_deref() {
        Some(id) => id,
        None => token.role.get_user(),
    };

    let preferences = users::service::get_preferences(&state.pool, owner_id).await?;

    let epub_id = epubs::service::write_epub(
        &state.pool,
        &state.config.kepubify.path,
        &state.config.book_storage.epub_path,
        &data.epub.to_vec(),
        &state.lock_manager,
    )
    .await?;

    if service::epub_is_in_use_by_user(&state.pool, &epub_id, owner_id).await {
        return Err(BookError::BookConflict.into());
    }

    let state_id = state::service::initialize_state(&state.pool).await;
    let book_sync_id = sync::service::initialize_book_sync(&state.pool).await;

    let book = Book {
        owner_id: owner_id.to_string(),
        epub_id,
        metadata_id: None,
        cover_id: None,
        state_id,
        book_sync_id,
    };

    let book_id = service::add_book(&state.pool, book).await?;

    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let automatic_metadata = preferences
        .automatic_metadata
        .expect("Metadata preference should be present");
    if automatic_metadata {
        state
            .metadata_manager
            .enqueue_request(
                owner_id,
                &book_id,
                preferences.metadata_providers.unwrap_or(vec![]),
            )
            .await?;
    }

    Ok(book_id)
}

pub async fn delete_book_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_book_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = service::get_book(&state.pool, &book_id).await?;
    service::delete_book(&state.pool, &book_id).await?;

    if let Some(metadata_id) = book.metadata_id {
        metadata::service::delete_metadata(&state.pool, &metadata_id).await?;
    }

    if !service::epub_is_in_use(&state.pool, &book.epub_id).await {
        epubs::service::delete_epub(&state.pool, &state.config.book_storage.epub_path, &book.epub_id).await?;
    }

    let cover_id = match book.cover_id {
        None => return Ok((StatusCode::NO_CONTENT, ())),
        Some(cover_id) => cover_id,
    };

    sync::service::update_book_delete_timestamp(&state.pool, &book.book_sync_id).await;

    if !service::cover_is_in_use(&state.pool, &cover_id).await {
        covers::service::delete_cover(
            &state.pool,
            &state.config.book_storage.cover_path,
            &cover_id,
            &state.cache.image_cache,
        )
        .await?;
    }

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn search_books_handler(
    State(pool): State<Pool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ProsaError> {
    if let Some(username) = params.get("username") {
        // Verify user exists
        users::service::get_user_by_username(&pool, username).await?;
    }

    let page = params.get("page").map(|t| t.parse::<i64>());
    let page = match page {
        Some(Ok(p)) => Some(p),
        None => None,
        _ => return Err(BookError::InvalidPagination.into()),
    };

    let size = params.get("size").map(|t| t.parse::<i64>());
    let size = match size {
        Some(Ok(s)) => Some(s),
        None => None,
        _ => return Err(BookError::InvalidPagination.into()),
    };

    let books = service::search_books(
        &pool,
        params.get("username").map(ToString::to_string),
        params.get("title").map(ToString::to_string),
        params.get("author").map(ToString::to_string),
        page,
        size,
    )
    .await?;

    Ok(Json(books))
}
