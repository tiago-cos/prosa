use crate::app::{
    AppState,
    authentication::models::{AuthError, AuthRole, AuthToken, CREATE, DELETE, READ, UPDATE},
    books::models::{BookError, UploadBookRequest},
    error::ProsaError,
};
use axum::{
    Extension,
    body::{Body, to_bytes},
    extract::{FromRequest, Path, Query, Request, State},
    middleware::Next,
    response::IntoResponse,
};
use axum_typed_multipart::TypedMultipart;
use std::collections::HashMap;

fn user_id_matches(user_id: &str, token: &AuthToken) -> bool {
    let token_user_id = match &token.role {
        AuthRole::Admin(_) => return true,
        AuthRole::User(id) => id,
    };

    user_id == token_user_id
}

pub async fn can_create_book(
    Extension(token): Extension<AuthToken>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&CREATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let (parts, body) = request.into_parts();
    let body_bytes = to_bytes(body, usize::MAX)
        .await
        .expect("Failed to extract body bytes");
    let request1 = Request::from_parts(parts.clone(), Body::from(body_bytes.clone()));
    let request2 = Request::from_parts(parts, Body::from(body_bytes));

    let data = TypedMultipart::<UploadBookRequest>::from_request(request1, &())
        .await
        .expect("Failed to parse request");

    match data.owner_id.as_deref() {
        Some(id) if !user_id_matches(id, &token) => return Err(AuthError::Forbidden.into()),
        _ => (),
    }

    Ok(next.run(request2).await)
}

pub async fn can_read_book(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let book = state.services.book.get_book(&book_id).await?;

    if !user_id_matches(&book.owner_id, &token) {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_search_books(
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

pub async fn can_delete_book(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&DELETE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let book = state.services.book.get_book(&book_id).await?;

    if !user_id_matches(&book.owner_id, &token) {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_update_book(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&UPDATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let book = state.services.book.get_book(&book_id).await?;

    if !user_id_matches(&book.owner_id, &token) {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request).await)
}
