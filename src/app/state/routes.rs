use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::books::{can_read_book, can_update_book},
    state::controller::{get_state_handler, patch_state_handler, update_state_handler},
};
use axum::{
    Router,
    middleware::from_fn,
    routing::{get, patch, put},
};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/books/{book_id}/state", get(get_state_handler)
            .route_layer(from_fn(can_read_book))
        )
        .route("/books/{book_id}/state", put(update_state_handler) 
            .route_layer(from_fn(can_update_book))
        )
        .route("/books/{book_id}/state", patch(patch_state_handler) 
            .route_layer(from_fn(can_update_book))
        )
        .layer(from_fn(extract_token_middleware))
}
