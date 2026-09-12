use crate::app::{
    authentication::models::{AuthError, AuthToken, READ, UPDATE},
    books::{self, models::BookError},
    error::ProsaError,
};
use axum::{
    Extension,
    extract::{Path, Request},
    middleware::Next,
    response::IntoResponse,
};

pub async fn can_read_annotation(
    Extension(token): Extension<AuthToken>,
    Path((book_id, _)): Path<(String, String)>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    let book = books::service::get_book(&book_id).await?;

    if !token.can_act_for(&book.owner_id) {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request).await)
}

pub async fn can_update_annotation(
    Extension(token): Extension<AuthToken>,
    Path((book_id, _)): Path<(String, String)>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(UPDATE) {
        return Err(AuthError::Forbidden.into());
    }

    let book = books::service::get_book(&book_id).await?;

    if !token.can_act_for(&book.owner_id) {
        return Err(BookError::BookNotFound.into());
    }

    Ok(next.run(request).await)
}
