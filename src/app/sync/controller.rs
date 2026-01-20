use super::models::SyncError;
use crate::app::{
    authentication::models::AuthToken,
    error::ProsaError,
    sync::{models::UnsyncedResponse, service},
};
use axum::{Extension, Json, extract::Query};
use std::collections::HashMap;

pub async fn get_unsynced_handler(
    Query(params): Query<HashMap<String, String>>,
    Extension(token): Extension<AuthToken>,
) -> Result<Json<UnsyncedResponse>, ProsaError> {
    let sync_token = params.get("sync_token").map(|t| t.parse::<i64>());

    let user_id = match params.get("user_id") {
        Some(id) => id,
        None => token.role.get_user(),
    };

    let sync_token = match sync_token {
        Some(Ok(t)) => t,
        None => -1,
        _ => return Err(SyncError::InvalidSyncToken.into()),
    };

    let unsynced = service::get_unsynced_changes(user_id, &token.session_id, sync_token).await?;

    Ok(Json(unsynced))
}
