use super::{models::SyncError, service};
use crate::app::{error::ProsaError, Pool};
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

pub async fn get_unsynced_handler(
    State(pool): State<Pool>,
    Path(user_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, ProsaError> {
    let since = params.get("since").map(|t| t.parse::<i64>());

    let since = match since {
        Some(Ok(t)) => DateTime::<Utc>::from_timestamp_millis(t),
        None => DateTime::<Utc>::from_timestamp_millis(0),
        _ => return Err(SyncError::InvalidTimestamp.into()),
    };

    let since = match since {
        None => return Err(SyncError::InvalidTimestamp.into()),
        Some(s) => s,
    };

    let unsynced = service::get_unsynced(&pool, &user_id, since).await?;
    Ok(Json(unsynced))
}
