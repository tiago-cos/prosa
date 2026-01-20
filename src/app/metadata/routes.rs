use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::{
        books::{can_delete_book, can_read_book, can_update_book},
        metadata::{can_add_metadata_request, can_list_metadata_requests},
    },
    metadata::controller::{
        add_metadata_handler, add_metadata_request_handler, delete_metadata_handler, get_metadata_handler,
        list_metadata_requests_handler, patch_metadata_handler, update_metadata_handler,
    },
};
use axum::{
    Router,
    middleware::from_fn,
    routing::{delete, get, patch, post, put},
};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/books/{book_id}/metadata", get(get_metadata_handler)
            .route_layer(from_fn(can_read_book))
        )
        .route("/books/{book_id}/metadata", post(add_metadata_handler) 
            .route_layer(from_fn(can_update_book))
        )
        .route("/books/{book_id}/metadata", delete(delete_metadata_handler) 
            .route_layer(from_fn(can_delete_book))
        )
        .route("/books/{book_id}/metadata", put(update_metadata_handler) 
            .route_layer(from_fn(can_update_book))
        )
        .route("/books/{book_id}/metadata", patch(patch_metadata_handler) 
            .route_layer(from_fn(can_update_book))
        )
        .route("/metadata-requests", post(add_metadata_request_handler) 
            .route_layer(from_fn(can_add_metadata_request))
        )
        .route("/metadata-requests", get(list_metadata_requests_handler) 
            .route_layer(from_fn(can_list_metadata_requests))
        )
        .layer(from_fn(extract_token_middleware))
}
