use super::models::SyncError;
use crate::app::{
    authentication::models::AuthToken,
    error::ProsaError,
    sync::{models::UnsyncedResponse, service::SyncService},
};
use axum::Json;
use chrono::{DateTime, Utc};
use std::{collections::HashMap, sync::Arc};

pub struct SyncController {
    sync_service: Arc<SyncService>,
}

impl SyncController {
    pub fn new(sync_service: Arc<SyncService>) -> Self {
        Self { sync_service }
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

        let book = self.sync_service.get_unsynced_books(user_id, since).await?;
        let shelf = self.sync_service.get_unsynced_shelves(user_id, since).await?;

        Ok(Json(UnsyncedResponse { book, shelf }))
    }
}
