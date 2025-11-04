use crate::app::{
    AppState,
    authentication::models::{AuthError, AuthRole, AuthToken, CREATE, DELETE, READ, UPDATE},
    books::models::BookError,
    error::ProsaError,
    shelves::models::{AddBookToShelfRequest, CreateShelfRequest, ShelfBookError, ShelfError},
};
use axum::{
    Extension, Json,
    body::{Body, to_bytes},
    extract::{FromRequest, Path, Query, Request, State},
    middleware::Next,
    response::IntoResponse,
};
use std::collections::HashMap;

fn user_id_matches(user_id: &str, token: &AuthToken) -> bool {
    let token_user_id = match &token.role {
        AuthRole::Admin(_) => return true,
        AuthRole::User(id) => id,
    };

    user_id == token_user_id
}

pub async fn can_create_shelf(
    Extension(token): Extension<AuthToken>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&CREATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let (parts, body) = request.into_parts();
    let body_bytes = to_bytes(body, 1000).await.expect("Failed to parse request");
    let request1 = Request::from_parts(parts.clone(), Body::from(body_bytes.clone()));
    let request2 = Request::from_parts(parts, Body::from(body_bytes));

    let Json(payload): Json<CreateShelfRequest> = match Json::from_request(request1, &()).await {
        Ok(p) => p,
        Err(_) => return Err(ShelfError::InvalidShelfRequest.into()),
    };

    match payload.owner_id.as_deref() {
        Some(id) if !user_id_matches(id, &token) => return Err(AuthError::Forbidden.into()),
        _ => (),
    }

    Ok(next.run(request2).await)
}

pub async fn can_read_shelf(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = state.services.shelf.get_shelf(&shelf_id).await?;

    if !user_id_matches(&shelf.owner_id, &token) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_update_shelf(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&UPDATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = state.services.shelf.get_shelf(&shelf_id).await?;

    if !user_id_matches(&shelf.owner_id, &token) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_delete_shelf(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&DELETE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = state.services.shelf.get_shelf(&shelf_id).await?;

    if !user_id_matches(&shelf.owner_id, &token) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_search_shelves(
    Extension(token): Extension<AuthToken>,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    if let AuthRole::Admin(_) = token.role {
        return Ok(next.run(request).await);
    }

    let Some(username) = params.get("username") else {
        return Err(AuthError::Forbidden.into());
    };

    let user_id = match state.services.user.get_user_by_username(username).await {
        Ok(u) => u.user_id,
        _ => return Err(AuthError::Forbidden.into()),
    };

    if user_id != token.role.get_user() {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_add_book_to_shelf(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&UPDATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = state.services.shelf.get_shelf(&shelf_id).await?;

    if !user_id_matches(&shelf.owner_id, &token) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    let (parts, body) = request.into_parts();
    let body_bytes = to_bytes(body, 1000).await.expect("Failed to parse request");
    let request1 = Request::from_parts(parts.clone(), Body::from(body_bytes.clone()));
    let request2 = Request::from_parts(parts, Body::from(body_bytes));

    let Json(payload): Json<AddBookToShelfRequest> = match Json::from_request(request1, &()).await {
        Ok(p) => p,
        Err(_) => return Err(ShelfError::InvalidShelfRequest.into()),
    };

    let book = state.services.book.get_book(&payload.book_id).await?;

    if !user_id_matches(&book.owner_id, &token) {
        return Err(BookError::BookNotFound.into());
    }

    if book.owner_id != shelf.owner_id {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request2).await)
}

pub async fn can_delete_book_from_shelf(
    Extension(token): Extension<AuthToken>,
    Path((shelf_id, book_id)): Path<(String, String)>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&UPDATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = state.services.shelf.get_shelf(&shelf_id).await?;

    if !user_id_matches(&shelf.owner_id, &token) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    let book = state
        .services
        .book
        .get_book(&book_id)
        .await
        .map_err(|_| ShelfBookError::ShelfBookNotFound)?;

    if !user_id_matches(&book.owner_id, &token) {
        return Err(ShelfBookError::ShelfBookNotFound.into());
    }

    Ok(next.run(request).await)
}
