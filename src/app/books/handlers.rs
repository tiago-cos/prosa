use super::{
    models::{Book, UploadBoodRequest},
    service,
};
use crate::app::{covers, epubs, error::ProsaError, metadata, state, sync, users, AppState};
use axum::{
    extract::{Path, State},
    response::IntoResponse,
};
use axum_typed_multipart::TypedMultipart;

pub async fn download_book_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let book = service::get_book(&state.pool, &book_id).await?;
    let epub = epubs::service::read_epub(&state.config.book_storage.epub_path, &book.epub_id).await?;

    Ok(epub)
}

pub async fn upload_book_handler(
    State(state): State<AppState>,
    TypedMultipart(data): TypedMultipart<UploadBoodRequest>,
) -> Result<impl IntoResponse, ProsaError> {
    let epub_id = epubs::service::write_epub(
        &state.pool,
        &state.config.kepubify.path,
        &state.config.book_storage.epub_path,
        &data.epub.to_vec(),
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

    let preferences = users::service::get_preferences(&state.pool, &data.owner_id).await?;
    let book_id = service::add_book(&state.pool, book).await?;

    tokio::spawn(state.metadata_manager.fetch_metadata(
        state.pool,
        book_id.clone(),
        preferences.metadata_providers,
    ));

    Ok(book_id)
}

pub async fn delete_book_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
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
        None => return Ok(()),
        Some(cover_id) => cover_id,
    };

    if !service::cover_is_in_use(&state.pool, &cover_id).await {
        covers::service::delete_cover(&state.pool, &state.config.book_storage.cover_path, &cover_id).await?;
    }

    Ok(())
}
