use super::{models::SyncError, service};
use crate::app::{
    Pool, authentication::models::AuthToken, error::ProsaError, sync::models::UnsyncedResponse,
};
use axum::{
    Extension, Json,
    extract::{Query, State},
    response::IntoResponse,
};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

pub async fn get_unsynced_handler(
    State(pool): State<Pool>,
    Query(params): Query<HashMap<String, String>>,
    Extension(token): Extension<AuthToken>,
) -> Result<impl IntoResponse, ProsaError> {
    let since = params.get("since").map(|t| t.parse::<i64>());

    let user_id = match params.get("user_id") {
        Some(id) => id,
        None => token.role.get_user(),
    };

    let since = match since {
        Some(Ok(t)) => DateTime::<Utc>::from_timestamp_millis(t),
        None => DateTime::<Utc>::from_timestamp_millis(0),
        _ => return Err(SyncError::InvalidTimestamp.into()),
    };

    let since = match since {
        None => return Err(SyncError::InvalidTimestamp.into()),
        Some(s) => s,
    };

    let book = service::get_unsynced_books(&pool, user_id, since).await?;
    let shelf = service::get_unsynced_shelves(&pool, user_id, since).await?;
    Ok(Json(UnsyncedResponse { book, shelf }))
}
