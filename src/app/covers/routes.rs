use super::handlers;
use crate::app::{
    AppState,
    authentication::middleware::extract_token_middleware,
    authorization::books::{can_delete_book, can_read_book, can_update_book},
};
use axum::{
    Router,
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/cover", get(handlers::get_cover_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/cover", post(handlers::add_cover_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/cover", delete(handlers::delete_cover_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_book))
        )
        .route("/books/{book_id}/cover", put(handlers::update_cover_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}
