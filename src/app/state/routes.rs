use super::handlers;
use crate::app::{
    AppState,
    authentication::middleware::extract_token_middleware,
    authorization::books::{can_read_book, can_update_book},
};
use axum::{
    Router,
    middleware::from_fn_with_state,
    routing::{get, patch, put},
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/state", get(handlers::get_state_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/state", put(handlers::update_state_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/state", patch(handlers::patch_state_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}
