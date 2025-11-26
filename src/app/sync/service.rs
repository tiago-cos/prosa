use super::models::UnsyncedBooks;
use crate::app::{
    error::ProsaError,
    sync::{
        models::{ChangeLogAction, ChangeLogEntityType, UnsyncedResponse, UnsyncedShelves},
        repository::SyncRepository,
    },
    users::repository::UserRepository,
};
use std::sync::Arc;

pub struct SyncService {
    sync_repository: Arc<SyncRepository>,
    user_repository: Arc<UserRepository>,
}

impl SyncService {
    pub fn new(sync_repository: Arc<SyncRepository>, user_repository: Arc<UserRepository>) -> Self {
        Self {
            sync_repository,
            user_repository,
        }
    }

    pub async fn log_change(
        &self,
        entity_id: &str,
        entity_type: ChangeLogEntityType,
        action: ChangeLogAction,
        owner_id: &str,
        session_id: &str,
    ) {
        if action == ChangeLogAction::Delete
            && matches!(
                entity_type,
                ChangeLogEntityType::BookFile | ChangeLogEntityType::ShelfMetadata
            )
        {
            self.sync_repository.delete_log_entries(entity_id).await;
        }

        self.sync_repository
            .log_change(entity_id, entity_type, action, owner_id, session_id)
            .await;
    }

    pub async fn get_unsynced_changes(
        &self,
        owner_id: &str,
        session_id: &str,
        sync_token: i64,
    ) -> Result<UnsyncedResponse, ProsaError> {
        // TODO is this really the best way to check?
        // Ensure user exists
        self.user_repository.get_user(owner_id).await?;

        let changes = self
            .sync_repository
            .get_changes(owner_id, sync_token, session_id)
            .await;

        let mut unsynced_books = UnsyncedBooks {
            file: Vec::new(),
            metadata: Vec::new(),
            cover: Vec::new(),
            state: Vec::new(),
            annotations: Vec::new(),
            deleted: Vec::new(),
        };

        let mut unsynced_shelves = UnsyncedShelves {
            contents: Vec::new(),
            metadata: Vec::new(),
            deleted: Vec::new(),
        };

        let new_sync_token = changes.last().map_or(sync_token, |entry| entry.log_id);

        for change in changes {
            match change.entity_type {
                ChangeLogEntityType::BookFile => {
                    if change.action == ChangeLogAction::Delete {
                        unsynced_books.deleted.push(change.entity_id);
                    } else {
                        unsynced_books.file.push(change.entity_id);
                    }
                }
                ChangeLogEntityType::BookMetadata => unsynced_books.metadata.push(change.entity_id),
                ChangeLogEntityType::BookCover => unsynced_books.cover.push(change.entity_id),
                ChangeLogEntityType::BookState => unsynced_books.state.push(change.entity_id),
                ChangeLogEntityType::BookAnnotations => unsynced_books.annotations.push(change.entity_id),
                ChangeLogEntityType::ShelfMetadata => {
                    if change.action == ChangeLogAction::Delete {
                        unsynced_shelves.deleted.push(change.entity_id);
                    } else {
                        unsynced_shelves.metadata.push(change.entity_id);
                    }
                }
                ChangeLogEntityType::ShelfContent => unsynced_shelves.contents.push(change.entity_id),
            }
        }

        Ok(UnsyncedResponse {
            new_sync_token,
            unsynced_books,
            unsynced_shelves,
        })
    }
}
