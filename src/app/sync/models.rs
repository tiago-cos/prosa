use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::prelude::FromRow;
use strum_macros::{EnumMessage, EnumProperty};

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum SyncError {
    #[strum(message = "The provided timestamp is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidTimestamp,
}

#[derive(FromRow)]
pub struct BookSync {
    pub file: DateTime<Utc>,
    pub metadata: Option<DateTime<Utc>>,
    pub cover: Option<DateTime<Utc>>,
    pub state: DateTime<Utc>,
    pub annotations: Option<DateTime<Utc>>,
    pub deleted: Option<DateTime<Utc>>,
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

#[derive(FromRow)]
pub struct ShelfSync {
    pub contents: Option<DateTime<Utc>>,
    pub metadata: DateTime<Utc>,
    pub deleted: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct UnsyncedShelves {
    pub contents: Vec<String>,
    pub metadata: Vec<String>,
    pub deleted: Vec<String>,
}

#[derive(Serialize)]
pub struct UnsyncedResponse {
    pub book: UnsyncedBooks,
    pub shelf: UnsyncedShelves,
}
