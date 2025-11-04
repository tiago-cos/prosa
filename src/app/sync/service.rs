use super::models::{BookSync, UnsyncedBooks};
use crate::app::{
    error::ProsaError,
    sync::{
        models::{ShelfSync, UnsyncedShelves},
        repository::SyncRepository,
    },
    users::repository::UserRepository,
};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

pub struct SyncService {
    user_repository: Arc<UserRepository>,
    sync_repository: Arc<SyncRepository>,
}

impl SyncService {
    pub fn new(user_repository: Arc<UserRepository>, sync_repository: Arc<SyncRepository>) -> Self {
        Self {
            user_repository,
            sync_repository,
        }
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

        self.sync_repository
            .add_book_sync_timestamps(&sync_id, sync)
            .await;
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

        self.sync_repository
            .add_shelf_sync_timestamps(&sync_id, sync)
            .await;
        sync_id
    }

    pub async fn get_unsynced_books(
        &self,
        owner_id: &str,
        since: DateTime<Utc>,
    ) -> Result<UnsyncedBooks, ProsaError> {
        // TODO is this really the best way to check?
        // Ensure user exists
        self.user_repository.get_user(owner_id).await?;
        let unsynced = self.sync_repository.get_unsynced_books(owner_id, since).await;
        Ok(unsynced)
    }

    pub async fn get_unsynced_shelves(
        &self,
        owner_id: &str,
        since: DateTime<Utc>,
    ) -> Result<UnsyncedShelves, ProsaError> {
        // Ensure user exists
        self.user_repository.get_user(owner_id).await?;
        let unsynced = self.sync_repository.get_unsynced_shelves(owner_id, since).await;
        Ok(unsynced)
    }

    pub async fn update_book_metadata_timestamp(&self, sync_id: &str) {
        let mut sync = self.sync_repository.get_book_sync_timestamps(sync_id).await;
        sync.metadata = Some(Utc::now());
        self.sync_repository
            .update_book_sync_timestamps(sync_id, sync)
            .await;
    }

    pub async fn update_cover_timestamp(&self, sync_id: &str) {
        let mut sync = self.sync_repository.get_book_sync_timestamps(sync_id).await;
        sync.cover = Some(Utc::now());
        self.sync_repository
            .update_book_sync_timestamps(sync_id, sync)
            .await;
    }

    pub async fn update_state_timestamp(&self, sync_id: &str) {
        let mut sync = self.sync_repository.get_book_sync_timestamps(sync_id).await;
        sync.state = Utc::now();
        self.sync_repository
            .update_book_sync_timestamps(sync_id, sync)
            .await;
    }

    pub async fn update_annotations_timestamp(&self, sync_id: &str) {
        let mut sync = self.sync_repository.get_book_sync_timestamps(sync_id).await;
        sync.annotations = Some(Utc::now());
        self.sync_repository
            .update_book_sync_timestamps(sync_id, sync)
            .await;
    }

    pub async fn update_book_delete_timestamp(&self, sync_id: &str) {
        let mut sync = self.sync_repository.get_book_sync_timestamps(sync_id).await;
        sync.deleted = Some(Utc::now());
        self.sync_repository
            .update_book_sync_timestamps(sync_id, sync)
            .await;
    }

    pub async fn update_shelf_contents_timestamp(&self, sync_id: &str) {
        let mut sync = self.sync_repository.get_shelf_sync_timestamps(sync_id).await;
        sync.contents = Some(Utc::now());
        self.sync_repository
            .update_shelf_sync_timestamps(sync_id, sync)
            .await;
    }

    pub async fn update_shelf_metadata_timestamp(&self, sync_id: &str) {
        let mut sync = self.sync_repository.get_shelf_sync_timestamps(sync_id).await;
        sync.metadata = Utc::now();
        self.sync_repository
            .update_shelf_sync_timestamps(sync_id, sync)
            .await;
    }

    pub async fn update_shelf_delete_timestamp(&self, sync_id: &str) {
        let mut sync = self.sync_repository.get_shelf_sync_timestamps(sync_id).await;
        sync.deleted = Some(Utc::now());
        self.sync_repository
            .update_shelf_sync_timestamps(sync_id, sync)
            .await;
    }
}
