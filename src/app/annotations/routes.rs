use crate::app::{
    AppState,
    annotations::models::{Annotation, NewAnnotationRequest, PatchAnnotationRequest},
    authentication::{middleware::extract_token_middleware, models::AuthToken},
    authorization::{
        annotations::{can_read_annotation, can_update_annotation},
        books::{can_read_book, can_update_book},
    },
    error::ProsaError,
};
use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    http::StatusCode,
    middleware::from_fn_with_state,
    routing::{delete, get, patch, post},
};

#[rustfmt::skip]
pub fn get_routes(state: AppState) -> Router {
    Router::new()
        .route("/books/{book_id}/annotations", post(add_annotation_handler)
            .route_layer(from_fn_with_state(state.clone(), can_update_book))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", get(get_annotation_handler)
            .route_layer(from_fn_with_state(state.clone(), can_read_annotation))
        )
        .route("/books/{book_id}/annotations", get(list_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_read_book))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", delete(delete_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_annotation))
        )
        .route("/books/{book_id}/annotations/{annotation_id}", patch(patch_annotation_handler) 
            .route_layer(from_fn_with_state(state.clone(), can_update_annotation))
        )
        .layer(from_fn_with_state(state.clone(), extract_token_middleware))
        .with_state(state)
}

async fn add_annotation_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path(book_id): Path<String>,
    Json(annotation): Json<NewAnnotationRequest>,
) -> Result<String, ProsaError> {
    state
        .controllers
        .annotation
        .add_annotation(token, &book_id, annotation)
        .await
}

async fn get_annotation_handler(
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
) -> Result<Json<Annotation>, ProsaError> {
    state
        .controllers
        .annotation
        .get_annotation(&book_id, &annotation_id)
        .await
}

async fn list_annotation_handler(
    State(state): State<AppState>,
    Path(book_id): Path<String>,
) -> Result<Json<Vec<String>>, ProsaError> {
    state.controllers.annotation.list_annotations(&book_id).await
}

async fn delete_annotation_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
) -> Result<StatusCode, ProsaError> {
    state
        .controllers
        .annotation
        .delete_annotation(token, &book_id, &annotation_id)
        .await
}

async fn patch_annotation_handler(
    Extension(token): Extension<AuthToken>,
    State(state): State<AppState>,
    Path((book_id, annotation_id)): Path<(String, String)>,
    Json(request): Json<PatchAnnotationRequest>,
) -> Result<StatusCode, ProsaError> {
    state
        .controllers
        .annotation
        .patch_annotation(token, &book_id, &annotation_id, request)
        .await
}
