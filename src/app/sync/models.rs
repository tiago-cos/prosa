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
pub struct Sync {
    pub file: DateTime<Utc>,
    pub metadata: DateTime<Utc>,
    pub cover: DateTime<Utc>,
    pub deleted: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct Unsynced {
    pub file: Vec<String>,
    pub metadata: Vec<String>,
    pub cover: Vec<String>,
    pub deleted: Vec<String>,
}
