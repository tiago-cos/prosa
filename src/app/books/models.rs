use axum::body::Bytes;
use axum_typed_multipart::TryFromMultipart;
use serde::Serialize;
use sqlx::{
    FromRow,
    error::{DatabaseError, ErrorKind},
    sqlite::SqliteError,
};
use strum_macros::{EnumMessage, EnumProperty};

type SqlxError = sqlx::Error;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum BookError {
    #[strum(message = "The requested book does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    BookNotFound,
    #[strum(message = "This book is already in your library.")]
    #[strum(props(StatusCode = "409"))]
    BookConflict,
    #[strum(message = "The requested pagination is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidPagination,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for BookError {
    fn from(error: SqlxError) -> Self {
        match error {
            SqlxError::RowNotFound => BookError::BookNotFound,
            SqlxError::Database(error) => error.downcast_ref::<SqliteError>().into(),
            _ => BookError::InternalError,
        }
    }
}

impl From<&SqliteError> for BookError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            ErrorKind::UniqueViolation => BookError::BookConflict,
            _ => BookError::InternalError,
        }
    }
}

#[derive(FromRow)]
pub struct Book {
    pub owner_id: String,
    pub epub_id: String,
    pub metadata_id: Option<String>,
    pub cover_id: Option<String>,
    pub state_id: String,
    pub book_sync_id: String,
}

#[derive(TryFromMultipart)]
pub struct UploadBoodRequest {
    pub owner_id: Option<String>,
    #[form_data(limit = "30MiB")]
    pub epub: Bytes,
}

#[derive(Serialize)]
pub struct PaginatedBooks {
    pub book_ids: Vec<String>,
    pub page_size: i64,
    pub total_elements: i64,
    pub total_pages: i64,
    pub current_page: i64,
}

#[derive(Serialize)]
pub struct BookFileMetadata {
    pub owner_id: String,
    pub file_size: u32,
}
