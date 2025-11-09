use std::collections::HashMap;

use crate::app::{
    AppState,
    authentication::{middleware::extract_token_middleware, models::AuthToken},
    authorization::books::{can_create_book, can_delete_book, can_read_book, can_search_books},
    books::models::{BookFileMetadataResponse, PaginatedBookResponse, UploadBookRequest},
    error::ProsaError,
};
use axum::{
    Extension, Json, Router,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    routing::{delete, get, post},
};
use axum_typed_multipart::TypedMultipart;

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books", post(upload_book_handler)
            .route_layer(from_fn_with_state(state.clone(), can_create_book))
        )
        .route("/books", get(search_books_handler)
            .route_layer(from_fn_with_state(state.clone(), can_search_books))
        )
        .route("/books/{book_id}", get(download_book_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}", delete(delete_book_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_book))
        )
        .route("/books/{book_id}/file-metadata", get(get_book_file_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .layer(DefaultBodyLimit::max(57671680))
        .with_state(state)
}

async fn upload_book_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    TypedMultipart(data): TypedMultipart<UploadBookRequest>,
) -> Result<String, ProsaError> {
    state.controllers.book.upload_book(token, data).await
}

async fn search_books_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<PaginatedBookResponse>, ProsaError> {
    state.controllers.book.search_books(params).await
}

async fn download_book_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<Vec<u8>, ProsaError> {
    state.controllers.book.download_book(book_id).await
}

async fn delete_book_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<StatusCode, ProsaError> {
    state.controllers.book.delete_book(book_id).await
}

async fn get_book_file_metadata_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<Json<BookFileMetadataResponse>, ProsaError> {
    state.controllers.book.get_book_file_metadata(book_id).await
}
