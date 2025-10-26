use crate::app::{
    AppState,
    authentication::models::{AuthError, AuthRole, AuthToken, READ, UPDATE},
    books::models::BookError,
    error::ProsaError,
};
use axum::{
    Extension,
    extract::{Path, Request, State},
    middleware::Next,
    response::IntoResponse,
};

fn user_id_matches(user_id: &str, token: &AuthToken) -> bool {
    let token_user_id = match &token.role {
        AuthRole::Admin(_) => return true,
        AuthRole::User(id) => id,
    };

    user_id == token_user_id
}

pub async fn can_read_annotation(
    Extension(token): Extension<AuthToken>,
    Path((book_id, _)): Path<(String, String)>,
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

pub async fn can_update_annotation(
    Extension(token): Extension<AuthToken>,
    Path((book_id, _)): Path<(String, String)>,
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
