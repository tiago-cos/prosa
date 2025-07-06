use super::handlers;
use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::{
        books::{can_delete_book, can_read_book, can_update_book},
        metadata::{can_add_metadata_request, can_list_metadata_requests},
    },
    AppState,
};
use axum::{
    middleware::from_fn_with_state,
    routing::{delete, get, patch, post, put},
    Router,
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/metadata", get(handlers::get_metadata_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/metadata", post(handlers::add_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/metadata", delete(handlers::delete_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_book))
        )
        .route("/books/{book_id}/metadata", put(handlers::update_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/metadata", patch(handlers::patch_metadata_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/metadata-requests", post(handlers::add_metadata_request_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_add_metadata_request))
        )
        .route("/metadata-requests", get(handlers::list_metadata_requests_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_list_metadata_requests))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}
