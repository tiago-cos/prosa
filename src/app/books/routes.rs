use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::books::{can_create_book, can_delete_book, can_read_book, can_search_books},
    books::controller::{
        delete_book_handler, download_book_handler, get_book_file_metadata_handler, search_books_handler,
        upload_book_handler,
    },
};
use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware::from_fn,
    routing::{delete, get, post},
};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/books", post(upload_book_handler)
            .route_layer(from_fn(can_create_book))
        )
        .route("/books", get(search_books_handler)
            .route_layer(from_fn(can_search_books))
        )
        .route("/books/{book_id}", get(download_book_handler) 
            .route_layer(from_fn(can_read_book))
        )
        .route("/books/{book_id}", delete(delete_book_handler) 
            .route_layer(from_fn(can_delete_book))
        )
        .route("/books/{book_id}/file-metadata", get(get_book_file_metadata_handler) 
            .route_layer(from_fn(can_read_book))
        )
        .layer(from_fn(extract_token_middleware))
        .layer(DefaultBodyLimit::max(57671680))
}
