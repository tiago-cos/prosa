use super::handlers;
use crate::app::{
    AppState,
    authentication::middleware::extract_token_middleware,
    authorization::shelves::{
        can_add_book_to_shelf, can_create_shelf, can_delete_book_from_shelf, can_delete_shelf,
        can_read_shelf, can_search_shelves, can_update_shelf,
    },
};
use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware::from_fn_with_state,
    routing::{delete, get, post, put},
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/shelves", post(handlers::add_shelf_handler)
            .route_layer(from_fn_with_state(state.clone(), can_create_shelf))
        )
        .route("/shelves/{shelf_id}", get(handlers::get_shelf_metadata_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_shelf))
        )
        .route("/shelves/{shelf_id}", put(handlers::update_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_shelf))
        )
        .route("/shelves/{shelf_id}", delete(handlers::delete_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_shelf))
        )
        .route("/shelves", get(handlers::search_shelves_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_search_shelves))
        )
        .route("/shelves/{shelf_id}/books", post(handlers::add_book_to_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_add_book_to_shelf))
        )
        .route("/shelves/{shelf_id}/books", get(handlers::list_books_in_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_shelf))
        )
        .route("/shelves/{shelf_id}/books/{book_id}", delete(handlers::remove_book_from_shelf_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_delete_book_from_shelf))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .layer(DefaultBodyLimit::max(31457280))
        .with_state(state)
}
