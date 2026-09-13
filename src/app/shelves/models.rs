use serde::{Deserialize, Serialize};
use sqlx::{
    FromRow,
    error::{DatabaseError, ErrorKind},
    sqlite::SqliteError,
};
use strum_macros::{EnumMessage, EnumProperty};

use crate::app::error::unmapped;

type SqlxError = sqlx::Error;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum ShelfError {
    #[strum(message = "The requested shelf does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    ShelfNotFound,
    #[strum(message = "There is already a shelf with this name in your library.")]
    #[strum(props(StatusCode = "409"))]
    ShelfConflict,
    #[strum(message = "The provided shelf name is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidName,
    #[strum(message = "The provided shelf request is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidShelfRequest,
    #[strum(message = "The provided shelf id is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidShelfId,
    #[strum(message = "The provided shelf id is already in use.")]
    #[strum(props(StatusCode = "409"))]
    ShelfIdConflict,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for ShelfError {
    fn from(error: SqlxError) -> Self {
        match &error {
            SqlxError::RowNotFound => ShelfError::ShelfNotFound,
            SqlxError::Database(database) => database.downcast_ref::<SqliteError>().into(),
            _ => unmapped(&error, ShelfError::InternalError),
        }
    }
}

impl From<&SqliteError> for ShelfError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            ErrorKind::UniqueViolation => ShelfError::ShelfConflict,
            _ => unmapped(error, ShelfError::InternalError),
        }
    }
}

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum ShelfBookError {
    #[strum(message = "The provided book is already present in this shelf.")]
    #[strum(props(StatusCode = "409"))]
    ShelfBookConflict,
    #[strum(message = "The provided book does not exist in this shelf, or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    ShelfBookNotFound,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for ShelfBookError {
    fn from(error: SqlxError) -> Self {
        match &error {
            SqlxError::RowNotFound => ShelfBookError::ShelfBookNotFound,
            SqlxError::Database(database) => database.downcast_ref::<SqliteError>().into(),
            _ => unmapped(&error, ShelfBookError::InternalError),
        }
    }
}

impl From<&SqliteError> for ShelfBookError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            ErrorKind::UniqueViolation => ShelfBookError::ShelfBookConflict,
            _ => unmapped(error, ShelfBookError::InternalError),
        }
    }
}

#[derive(FromRow)]
pub struct Shelf {
    pub name: String,
    pub owner_id: String,
}

#[derive(Serialize)]
pub struct ShelfMetadata {
    pub name: String,
    pub owner_id: String,
    pub book_count: i64,
}

#[derive(Serialize)]
pub struct PaginatedShelves {
    pub shelf_ids: Vec<String>,
    pub page_size: i64,
    pub total_elements: i64,
    pub total_pages: i64,
    pub current_page: i64,
}

#[derive(Deserialize)]
pub struct CreateShelfRequest {
    pub name: String,
    pub owner_id: Option<String>,
    pub shelf_id: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateShelfRequest {
    pub name: String,
}

#[derive(Deserialize)]
pub struct AddBookToShelfRequest {
    pub book_id: String,
}
