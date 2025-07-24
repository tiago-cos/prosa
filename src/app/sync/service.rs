use super::{
    data,
    models::{BookSync, UnsyncedBooks},
};
use crate::app::{
    error::ProsaError,
    sync::models::{ShelfSync, UnsyncedShelves},
    users,
};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn initialize_book_sync(pool: &SqlitePool) -> String {
    let now = Utc::now();
    let sync_id = Uuid::new_v4().to_string();

    let sync = BookSync {
        file: now,
        metadata: None,
        cover: None,
        state: now,
        annotations: None,
        deleted: None,
    };

    data::add_book_sync_timestamps(pool, &sync_id, sync).await;

    sync_id
}

pub async fn initialize_shelf_sync(pool: &SqlitePool) -> String {
    let now = Utc::now();
    let sync_id = Uuid::new_v4().to_string();

    let sync = ShelfSync {
        contents: None,
        metadata: now,
        deleted: None,
    };

    data::add_shelf_sync_timestamps(pool, &sync_id, sync).await;

    sync_id
}

pub async fn get_unsynced_books(
    pool: &SqlitePool,
    owner_id: &str,
    since: DateTime<Utc>,
) -> Result<UnsyncedBooks, ProsaError> {
    // To verify that the user exists
    users::data::get_user(pool, owner_id).await?;

    let unsynced = data::get_unsynced_books(pool, owner_id, since).await;
    Ok(unsynced)
}

pub async fn update_book_metadata_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_book_sync_timestamps(pool, sync_id).await;
    sync.metadata = Some(Utc::now());
    data::update_book_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn update_cover_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_book_sync_timestamps(pool, sync_id).await;
    sync.cover = Some(Utc::now());
    data::update_book_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn update_state_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_book_sync_timestamps(pool, sync_id).await;
    sync.state = Utc::now();
    data::update_book_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn update_annotations_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_book_sync_timestamps(pool, sync_id).await;
    sync.annotations = Some(Utc::now());
    data::update_book_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn update_book_delete_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_book_sync_timestamps(pool, sync_id).await;
    sync.deleted = Some(Utc::now());
    data::update_book_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn get_unsynced_shelves(
    pool: &SqlitePool,
    owner_id: &str,
    since: DateTime<Utc>,
) -> Result<UnsyncedShelves, ProsaError> {
    // To verify that the user exists
    users::data::get_user(pool, owner_id).await?;

    let unsynced = data::get_unsynced_shelves(pool, owner_id, since).await;
    Ok(unsynced)
}

pub async fn update_shelf_contents_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_shelf_sync_timestamps(pool, sync_id).await;
    sync.contents = Some(Utc::now());
    data::update_shelf_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn update_shelf_metadata_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_shelf_sync_timestamps(pool, sync_id).await;
    sync.metadata = Utc::now();
    data::update_shelf_sync_timestamps(pool, sync_id, sync).await;
}

pub async fn update_shelf_delete_timestamp(pool: &SqlitePool, sync_id: &str) -> () {
    let mut sync = data::get_shelf_sync_timestamps(pool, sync_id).await;
    sync.deleted = Some(Utc::now());
    data::update_shelf_sync_timestamps(pool, sync_id, sync).await;
}
