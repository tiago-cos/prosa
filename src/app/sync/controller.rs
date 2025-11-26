use super::models::SyncError;
use crate::app::{
    authentication::models::AuthToken,
    error::ProsaError,
    sync::{models::UnsyncedResponse, service::SyncService},
};
use axum::Json;
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
        let sync_token = query_params.get("sync_token").map(|t| t.parse::<i64>());

        let user_id = match query_params.get("user_id") {
            Some(id) => id,
            None => token.role.get_user(),
        };

        let sync_token = match sync_token {
            Some(Ok(t)) => t,
            None => -1,
            _ => return Err(SyncError::InvalidSyncToken.into()),
        };

        let unsynced = self
            .sync_service
            .get_unsynced_changes(user_id, &token.session_id, sync_token)
            .await?;

        Ok(Json(unsynced))
    }
}
