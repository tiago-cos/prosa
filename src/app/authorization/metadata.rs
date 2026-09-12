use crate::app::{
    authentication::models::{AuthError, AuthRole, AuthToken, READ, UPDATE},
    books::{self, models::BookError},
    error::ProsaError,
    metadata::models::{MetadataError, MetadataFetchRequest},
};
use axum::{
    Extension, Json,
    body::{Body, to_bytes},
    extract::{FromRequest, Query, Request},
    middleware::Next,
    response::IntoResponse,
};
use std::collections::HashMap;

pub async fn can_list_metadata_requests(
    Extension(token): Extension<AuthToken>,
    Query(params): Query<HashMap<String, String>>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    let is_admin = matches!(&token.role, AuthRole::Admin(_));

    match params.get("user_id") {
        Some(id) if !token.can_act_for(id) => Err(AuthError::Forbidden.into()),
        Some(id) if token.can_act_for(id) => Ok(next.run(request).await),
        None if is_admin => Ok(next.run(request).await),
        _ => Err(AuthError::Forbidden.into()),
    }
}

pub async fn can_add_metadata_request(
    Extension(token): Extension<AuthToken>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(UPDATE) {
        return Err(AuthError::Forbidden.into());
    }

    let (parts, body) = request.into_parts();
    let body_bytes = to_bytes(body, 1000).await.expect("Failed to parse request");
    let request1 = Request::from_parts(parts.clone(), Body::from(body_bytes.clone()));
    let request2 = Request::from_parts(parts, Body::from(body_bytes));

    let Json(payload): Json<MetadataFetchRequest> = match Json::from_request(request1, &()).await {
        Ok(p) => p,
        Err(_) => return Err(MetadataError::InvalidMetadataRequest.into()),
    };

    let book = books::service::get_book(&payload.book_id).await?;

    if !token.can_act_for(&book.owner_id) {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request2).await)
}
