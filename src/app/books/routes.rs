use super::handlers;
use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::books::{can_create_book, can_delete_book, can_read_book, can_search_books},
    AppState,
};
use axum::{
    extract::DefaultBodyLimit,
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Router,
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books", post(handlers::upload_book_handler)
            .route_layer(from_fn_with_state(state.clone(), can_create_book))
        )
        .route("/books", get(handlers::search_books_handler)
            .route_layer(from_fn_with_state(state.clone(), can_search_books))
        )
        .route("/books/{book_id}", get(handlers::download_book_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}", delete(handlers::delete_book_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_book))
        )
        .route("/books/{book_id}/file-metadata", get(handlers::get_book_file_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .layer(DefaultBodyLimit::max(31457280))
        .with_state(state)
}
