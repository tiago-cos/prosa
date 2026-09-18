use crate::app::{
    authentication::models::{AuthError, AuthToken, READ},
    error::ProsaError,
};
use axum::{Extension, extract::Request, middleware::Next, response::IntoResponse};

pub async fn can_read_identity(
    Extension(token): Extension<AuthToken>,
    request: Request,
    next: Next,
) -> Result<impl IntoResponse, ProsaError> {
    if !token.can(READ) {
        return Err(AuthError::Forbidden.into());
    }

    Ok(next.run(request).await)
}
