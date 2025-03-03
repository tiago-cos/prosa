use crate::app::{
    authentication::models::{AuthError, AuthRole, AuthToken, CREATE, DELETE, READ, UPDATE},
    books::{
        self,
        models::{BookError, UploadBoodRequest},
    },
    error::ProsaError,
    Pool,
};
use axum::{
    body::{to_bytes, Body},
    extract::{FromRequest, Path, Query, Request, State},
    middleware::Next,
    response::IntoResponse,
    Extension,
};
use axum_typed_multipart::TypedMultipart;
use std::{collections::HashMap, usize};

async fn username_matches(username: &str, token: &AuthToken) -> bool {
    let user_id = match &token.role {
        AuthRole::Admin(_) => return true,
        AuthRole::User(id) => id,
    };

    username == user_id
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

    let data = TypedMultipart::<UploadBoodRequest>::from_request(request1, &())
        .await
        .expect("Failed to parse request");

    if !username_matches(&data.owner_id, &token).await {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request2).await)
}

pub async fn can_read_book(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    State(pool): State<Pool>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let book = books::service::get_book(&pool, &book_id).await?;

    if !username_matches(&book.owner_id, &token).await {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_search_books(
    Extension(token): Extension<AuthToken>,
    Query(params): Query<HashMap<String, String>>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&READ.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    match params.get("username") {
        None if !username_matches("", &token).await => return Err(AuthError::Forbidden.into()),
        Some(u) if !username_matches(u, &token).await => return Err(AuthError::Forbidden.into()),
        _ => (),
    };

    Ok(next.run(request).await)
}

pub async fn can_delete_book(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    State(pool): State<Pool>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&DELETE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let book = books::service::get_book(&pool, &book_id).await?;

    if !username_matches(&book.owner_id, &token).await {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_update_book(
    Extension(token): Extension<AuthToken>,
    Path(book_id): Path<String>,
    State(pool): State<Pool>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.capabilities.contains(&UPDATE.to_string()) {
        return Err(AuthError::Forbidden.into());
    }

    let book = books::service::get_book(&pool, &book_id).await?;

    if !username_matches(&book.owner_id, &token).await {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request).await)
}
