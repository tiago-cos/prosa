use super::{models::SyncError, service};
use crate::app::{authentication::models::AuthToken, error::ProsaError, sync::models::UnsyncedResponse};
use axum::Json;
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use std::collections::HashMap;

pub struct SyncController {
    pool: SqlitePool,
}

impl SyncController {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_unsynced(
        &self,
        query_params: HashMap<String, String>,
        token: AuthToken,
    ) -> Result<Json<UnsyncedResponse>, ProsaError> {
        let since = query_params.get("since").map(|t| t.parse::<i64>());

        let user_id = match query_params.get("user_id") {
            Some(id) => id,
            None => token.role.get_user(),
        };

        let since = match since {
            Some(Ok(t)) => DateTime::<Utc>::from_timestamp_millis(t),
            None => DateTime::<Utc>::from_timestamp_millis(0),
            _ => return Err(SyncError::InvalidTimestamp.into()),
        };

        let Some(since) = since else {
            return Err(SyncError::InvalidTimestamp.into());
        };

        let book = service::get_unsynced_books(&self.pool, user_id, since).await?;
        let shelf = service::get_unsynced_shelves(&self.pool, user_id, since).await?;

        Ok(Json(UnsyncedResponse { book, shelf }))
    }
}
