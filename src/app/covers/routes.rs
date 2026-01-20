use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::books::{can_delete_book, can_read_book, can_update_book},
    covers::controller::{add_cover_handler, delete_cover_handler, get_cover_handler, update_cover_handler},
};
use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware::from_fn,
    routing::{delete, get, post, put},
};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/books/{book_id}/cover", get(get_cover_handler)
            .route_layer(from_fn(can_read_book))
        )
        .route("/books/{book_id}/cover", post(add_cover_handler) 
            .route_layer(from_fn(can_update_book))
        )
        .route("/books/{book_id}/cover", delete(delete_cover_handler) 
            .route_layer(from_fn(can_delete_book))
        )
        .route("/books/{book_id}/cover", put(update_cover_handler) 
            .route_layer(from_fn(can_update_book))
        )
        .layer(from_fn(extract_token_middleware))
        .layer(DefaultBodyLimit::max(15728640))
}
