use super::models::{BookSync, UnsyncedBooks};
use crate::app::{
    error::ProsaError,
    sync::models::{ShelfSync, UnsyncedShelves},
    users,
};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

pub struct SyncService {
    pool: SqlitePool,
}

impl SyncService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn initialize_book_sync(&self) -> String {
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

        super::data::add_book_sync_timestamps(&self.pool, &sync_id, sync).await;
        sync_id
    }

    pub async fn initialize_shelf_sync(&self) -> String {
        let now = Utc::now();
        let sync_id = Uuid::new_v4().to_string();

        let sync = ShelfSync {
            contents: None,
            metadata: now,
            deleted: None,
        };

        super::data::add_shelf_sync_timestamps(&self.pool, &sync_id, sync).await;
        sync_id
    }

    pub async fn get_unsynced_books(
        &self,
        owner_id: &str,
        since: DateTime<Utc>,
    ) -> Result<UnsyncedBooks, ProsaError> {
        // Ensure user exists
        users::data::get_user(&self.pool, owner_id).await?;
        let unsynced = super::data::get_unsynced_books(&self.pool, owner_id, since).await;
        Ok(unsynced)
    }

    pub async fn get_unsynced_shelves(
        &self,
        owner_id: &str,
        since: DateTime<Utc>,
    ) -> Result<UnsyncedShelves, ProsaError> {
        // Ensure user exists
        users::data::get_user(&self.pool, owner_id).await?;
        let unsynced = super::data::get_unsynced_shelves(&self.pool, owner_id, since).await;
        Ok(unsynced)
    }

    pub async fn update_book_metadata_timestamp(&self, sync_id: &str) {
        let mut sync = super::data::get_book_sync_timestamps(&self.pool, sync_id).await;
        sync.metadata = Some(Utc::now());
        super::data::update_book_sync_timestamps(&self.pool, sync_id, sync).await;
    }

    pub async fn update_cover_timestamp(&self, sync_id: &str) {
        let mut sync = super::data::get_book_sync_timestamps(&self.pool, sync_id).await;
        sync.cover = Some(Utc::now());
        super::data::update_book_sync_timestamps(&self.pool, sync_id, sync).await;
    }

    pub async fn update_state_timestamp(&self, sync_id: &str) {
        let mut sync = super::data::get_book_sync_timestamps(&self.pool, sync_id).await;
        sync.state = Utc::now();
        super::data::update_book_sync_timestamps(&self.pool, sync_id, sync).await;
    }

    pub async fn update_annotations_timestamp(&self, sync_id: &str) {
        let mut sync = super::data::get_book_sync_timestamps(&self.pool, sync_id).await;
        sync.annotations = Some(Utc::now());
        super::data::update_book_sync_timestamps(&self.pool, sync_id, sync).await;
    }

    pub async fn update_book_delete_timestamp(&self, sync_id: &str) {
        let mut sync = super::data::get_book_sync_timestamps(&self.pool, sync_id).await;
        sync.deleted = Some(Utc::now());
        super::data::update_book_sync_timestamps(&self.pool, sync_id, sync).await;
    }

    pub async fn update_shelf_contents_timestamp(&self, sync_id: &str) {
        let mut sync = super::data::get_shelf_sync_timestamps(&self.pool, sync_id).await;
        sync.contents = Some(Utc::now());
        super::data::update_shelf_sync_timestamps(&self.pool, sync_id, sync).await;
    }

    pub async fn update_shelf_metadata_timestamp(&self, sync_id: &str) {
        let mut sync = super::data::get_shelf_sync_timestamps(&self.pool, sync_id).await;
        sync.metadata = Utc::now();
        super::data::update_shelf_sync_timestamps(&self.pool, sync_id, sync).await;
    }

    pub async fn update_shelf_delete_timestamp(&self, sync_id: &str) {
        let mut sync = super::data::get_shelf_sync_timestamps(&self.pool, sync_id).await;
        sync.deleted = Some(Utc::now());
        super::data::update_shelf_sync_timestamps(&self.pool, sync_id, sync).await;
    }
}
