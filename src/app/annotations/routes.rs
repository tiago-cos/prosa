use crate::app::{
    annotations::controller::{
        add_annotation_handler, delete_annotation_handler, get_annotation_handler, list_annotations_handler,
        patch_annotation_handler,
    },
    authentication::middleware::extract_token_middleware,
    authorization::{
        annotations::{can_read_annotation, can_update_annotation},
        books::{can_read_book, can_update_book},
    },
};
use axum::{
    Router,
    middleware::from_fn,
    routing::{delete, get, patch, post},
};

#[rustfmt::skip]
pub fn get_routes() -> Router {
    Router::new()
        .route("/books/{book_id}/annotations", post(add_annotation_handler)
            .route_layer(from_fn(can_update_book))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", get(get_annotation_handler)
            .route_layer(from_fn(can_read_annotation))
        )
        .route("/books/{book_id}/annotations", get(list_annotations_handler) 
            .route_layer(from_fn(can_read_book))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", delete(delete_annotation_handler) 
            .route_layer(from_fn(can_update_annotation))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", patch(patch_annotation_handler) 
            .route_layer(from_fn(can_update_annotation))
        )
        .layer(from_fn(extract_token_middleware))
}
