use super::{
    models::{Book, BookError, UploadBoodRequest},
    service,
};
use crate::app::{
    books::models::BookFileMetadata, covers, epubs, error::ProsaError, metadata, state, sync, users,
    AppState, Pool,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use axum_typed_multipart::TypedMultipart;
use std::collections::HashMap;

pub async fn download_book_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = service::get_book(&state.pool, &book_id).await?;
    let epub = epubs::service::read_epub(&state.config.book_storage.epub_path, &book.epub_id).await?;

    Ok(epub)
}

pub async fn get_book_file_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.read().await;

    let book = service::get_book(&state.pool, &book_id).await?;
    let file_size = epubs::service::get_file_size(&state.config.book_storage.epub_path, &book.epub_id).await;

    Ok(Json(BookFileMetadata {
        owner_id: book.owner_id,
        file_size,
    }))
}

pub async fn upload_book_handler(
    State(state): State<AppState>,
    TypedMultipart(data): TypedMultipart<UploadBoodRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let preferences = users::service::get_preferences(&state.pool, &data.owner_id).await?;

    let epub_id = epubs::service::write_epub(
        &state.pool,
        &state.config.kepubify.path,
        &state.config.book_storage.epub_path,
        &data.epub.to_vec(),
        &state.lock_manager,
    )
    .await?;
    let state_id = state::service::initialize_state(&state.pool).await;
    let sync_id = sync::service::initialize_sync(&state.pool).await;

    let book = Book {
        owner_id: data.owner_id.clone(),
        epub_id,
        metadata_id: None,
        cover_id: None,
        state_id,
        sync_id,
    };

    let book_id = service::add_book(&state.pool, book).await?;

    tokio::spawn(state.metadata_manager.fetch_metadata(
        state.pool,
        state.lock_manager,
        state.cache.image_cache,
        book_id.clone(),
        preferences.metadata_providers,
    ));

    Ok(book_id)
}

pub async fn delete_book_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let lock = state.lock_manager.get_lock(&book_id).await;
    let _guard = lock.write().await;

    let book = service::get_book(&state.pool, &book_id).await?;
    service::delete_book(&state.pool, &book_id).await?;

    sync::service::update_delete_timestamp(&state.pool, &book.sync_id).await;

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

    if !service::cover_is_in_use(&state.pool, &cover_id).await {
        covers::service::delete_cover(
            &state.pool,
            &state.config.book_storage.cover_path,
            &cover_id,
            &state.cache.image_cache,
        )
        .await?;
    }

    drop(_guard);
    state.lock_manager.delete_lock(&book_id).await;

    Ok((StatusCode::NO_CONTENT, ()))
}

pub async fn search_books_handler(
    State(pool): State<Pool>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ProsaError> {
    if let Some(user_id) = params.get("username") {
        users::service::user_exists(&pool, &user_id).await?;
    };

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
        params.get("username").map(|s| s.to_string()),
        params.get("title").map(|s| s.to_string()),
        params.get("author").map(|s| s.to_string()),
        page,
        size,
    )
    .await?;

    Ok(Json(books))
}
