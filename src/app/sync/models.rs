use serde::Serialize;
use sqlx::{Type, prelude::FromRow};
use strum_macros::{EnumMessage, EnumProperty};

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum SyncError {
    #[strum(message = "The provided sync token is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidSyncToken,
}

#[derive(Type, PartialEq)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum ChangeLogEntityType {
    BookFile,
    BookMetadata,
    BookCover,
    BookState,
    BookAnnotations,
    ShelfMetadata,
    ShelfContent,
}

#[derive(Type, PartialEq)]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum ChangeLogAction {
    Create,
    Update,
    Delete,
}

#[derive(FromRow)]
#[allow(dead_code)]
pub struct ChangeLogEntry {
    pub log_id: i64,
    pub entity_id: String,
    pub entity_type: ChangeLogEntityType,
    pub owner_id: String,
    pub session_id: String,
    pub action: ChangeLogAction,
}

#[derive(Serialize)]
pub struct UnsyncedBooks {
    pub file: Vec<String>,
    pub metadata: Vec<String>,
    pub cover: Vec<String>,
    pub state: Vec<String>,
    pub annotations: Vec<String>,
    pub deleted: Vec<String>,
}

#[derive(Serialize)]
pub struct UnsyncedShelves {
    pub contents: Vec<String>,
    pub metadata: Vec<String>,
    pub deleted: Vec<String>,
}

//TODO change sync structs in kobont, adjust logic accordingly

#[derive(Serialize)]
pub struct UnsyncedResponse {
    pub new_sync_token: i64,
    pub unsynced_books: UnsyncedBooks,
    pub unsynced_shelves: UnsyncedShelves,
}
