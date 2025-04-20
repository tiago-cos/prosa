use super::handlers;
use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::{
        annotations::{can_read_annotation, can_update_annotation},
        books::{can_read_book, can_update_book},
    },
    AppState,
};
use axum::{
    middleware::from_fn_with_state,
    routing::{delete, get, patch, post},
    Router,
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/annotations", post(handlers::add_annotation_handler)
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", get(handlers::get_annotation_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_annotation))
        )
        .route("/books/{book_id}/annotations", get(handlers::list_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", delete(handlers::delete_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_annotation))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", patch(handlers::patch_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_annotation))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}
