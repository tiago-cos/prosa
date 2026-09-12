use crate::app::{
    authentication::models::{AuthError, AuthRole, AuthToken, CREATE, DELETE, READ, UPDATE},
    books::{self, models::BookError},
    error::ProsaError,
    shelves::{
        self,
        models::{AddBookToShelfRequest, CreateShelfRequest, ShelfBookError, ShelfError},
    },
    users,
};
use axum::{
    Extension, Json,
    body::{Body, to_bytes},
    extract::{FromRequest, Path, Query, Request},
    middleware::Next,
    response::IntoResponse,
};
use std::collections::HashMap;

pub async fn can_create_shelf(
    Extension(token): Extension<AuthToken>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(CREATE) {
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
        Some(id) if !token.can_act_for(id) => return Err(AuthError::Forbidden.into()),
        _ => (),
    }

    Ok(next.run(request2).await)
}

pub async fn can_read_shelf(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = shelves::service::get_shelf(&shelf_id).await?;

    if !token.can_act_for(&shelf.owner_id) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_update_shelf(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(UPDATE) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = shelves::service::get_shelf(&shelf_id).await?;

    if !token.can_act_for(&shelf.owner_id) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_delete_shelf(
    Extension(token): Extension<AuthToken>,
    Path(shelf_id): Path<String>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(DELETE) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = shelves::service::get_shelf(&shelf_id).await?;

    if !token.can_act_for(&shelf.owner_id) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_search_shelves(
    Extension(token): Extension<AuthToken>,
    Query(params): Query<HashMap<String, String>>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    if let AuthRole::Admin(_) = token.role {
        return Ok(next.run(request).await);
    }

    let Some(username) = params.get("username") else {
        return Err(AuthError::Forbidden.into());
    };

    let user_id = match users::service::get_user_by_username(username).await {
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
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(UPDATE) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = shelves::service::get_shelf(&shelf_id).await?;

    if !token.can_act_for(&shelf.owner_id) {
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

    let book = books::service::get_book(&payload.book_id).await?;

    if !token.can_act_for(&book.owner_id) {
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
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(UPDATE) {
        return Err(AuthError::Forbidden.into());
    }

    let shelf = shelves::service::get_shelf(&shelf_id).await?;

    if !token.can_act_for(&shelf.owner_id) {
        return Err(ShelfError::ShelfNotFound.into());
    }

    let book = books::service::get_book(&book_id)
        .await
        .map_err(|_| ShelfBookError::ShelfBookNotFound)?;

    if !token.can_act_for(&book.owner_id) {
        return Err(ShelfBookError::ShelfBookNotFound.into());
    }

    Ok(next.run(request).await)
}
