use crate::app::{
    authentication::middleware::extract_token_middleware,
    authorization::shelves::{
        can_add_book_to_shelf, can_create_shelf, can_delete_book_from_shelf, can_delete_shelf,
        can_read_shelf, can_search_shelves, can_update_shelf,
    },
    shelves::controller::{
        add_book_to_shelf_handler, add_shelf_handler, delete_shelf_handler, get_shelf_metadata_handler,
        list_books_in_shelf_handler, remove_book_from_shelf_handler, search_shelves_handler,
        update_shelf_handler,
    },
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
        .route("/shelves", post(add_shelf_handler)
            .route_layer(from_fn(can_create_shelf))
        )
        .route("/shelves/{shelf_id}", get(get_shelf_metadata_handler)
            .route_layer(from_fn(can_read_shelf))
        )
        .route("/shelves/{shelf_id}", put(update_shelf_handler) 
            .route_layer(from_fn(can_update_shelf))
        )
        .route("/shelves/{shelf_id}", delete(delete_shelf_handler) 
            .route_layer(from_fn(can_delete_shelf))
        )
        .route("/shelves", get(search_shelves_handler) 
            .route_layer(from_fn(can_search_shelves))
        )
        .route("/shelves/{shelf_id}/books", post(add_book_to_shelf_handler) 
            .route_layer(from_fn(can_add_book_to_shelf))
        )
        .route("/shelves/{shelf_id}/books", get(list_books_in_shelf_handler) 
            .route_layer(from_fn(can_read_shelf))
        )
        .route("/shelves/{shelf_id}/books/{book_id}", delete(remove_book_from_shelf_handler) 
            .route_layer(from_fn(can_delete_book_from_shelf))
        )
        .layer(from_fn(extract_token_middleware))
        .layer(DefaultBodyLimit::max(31457280))
}
