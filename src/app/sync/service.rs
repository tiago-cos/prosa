use crate::app::{error::ProsaError, users};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use super::{
    data,
    models::{Sync, Unsynced},
};

pub async fn initialize_sync(pool: &SqlitePool) -> String {
    let now = Utc::now();
    let sync_id = Uuid::new_v4().to_string();

    let sync = Sync {
        file: now,
        metadata: now,
        cover: now,
        deleted: None,
    };

    data::add_sync_timestamps(pool, &sync_id, sync).await;

    sync_id
}

pub async fn get_unsynced(
    pool: &SqlitePool,
    owner_id: &str,
    since: DateTime<Utc>,
) -> Result<Unsynced, ProsaError> {
    // To verify that the user exists
    users::data::get_user(pool, owner_id).await?;

    let unsynced = data::get_unsynced(pool, owner_id, since).await;
    Ok(unsynced)
}

pub async fn update_metadata_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_sync_timestamps(pool, sync_id).await;
    sync.metadata = Utc::now();
    data::update_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn update_cover_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_sync_timestamps(pool, sync_id).await;
    sync.cover = Utc::now();
    data::update_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn update_delete_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_sync_timestamps(pool, sync_id).await;
    sync.deleted = Some(Utc::now());
    data::update_sync_timestamps(pool, sync_id, sync).await;
}
