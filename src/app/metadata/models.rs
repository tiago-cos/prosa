use chrono::{serde::ts_milliseconds_option, DateTime, Utc};
use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;
use sqlx::{
    error::{DatabaseError, ErrorKind},
    prelude::FromRow,
    sqlite::SqliteError,
};
use strum_macros::{EnumMessage, EnumProperty};

type SqlxError = sqlx::Error;

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum MetadataError {
    #[strum(message = "The provided metadata is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidMetadata,
    #[strum(message = "The requested metadata does not exist or is not accessible.")]
    #[strum(props(StatusCode = "404"))]
    MetadataNotFound,
    #[strum(message = "This book already has metadata.")]
    #[strum(props(StatusCode = "409"))]
    MetadataConflict,
    #[strum(message = "Internal error")]
    #[strum(props(StatusCode = "500"))]
    InternalError,
}

impl From<SqlxError> for MetadataError {
    fn from(error: SqlxError) -> Self {
        match error {
            SqlxError::RowNotFound => MetadataError::MetadataNotFound,
            SqlxError::Database(error) => error.downcast_ref::<SqliteError>().into(),
            _ => MetadataError::InternalError,
        }
    }
}

impl From<&SqliteError> for MetadataError {
    fn from(error: &SqliteError) -> Self {
        match error.kind() {
            ErrorKind::UniqueViolation => MetadataError::MetadataConflict,
            ErrorKind::ForeignKeyViolation => MetadataError::MetadataNotFound,
            _ => MetadataError::InternalError,
        }
    }
}

#[derive(FromRow, Serialize, Deserialize)]
pub struct Contributor {
    pub name: String,
    pub role: String,
}

#[derive(FromRow, Serialize, Deserialize)]
pub struct Series {
    pub title: String,
    pub number: f32,
}

#[skip_serializing_none]
#[derive(FromRow, Merge, Serialize, Deserialize, Default)]
#[merge(strategy = merge::option::overwrite_none)]
pub struct Metadata {
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    #[serde(default, with = "ts_milliseconds_option")]
    pub publication_date: Option<DateTime<Utc>>,
    pub isbn: Option<String>,
    #[sqlx(skip)]
    pub contributors: Option<Vec<Contributor>>,
    #[sqlx(skip)]
    pub genres: Option<Vec<String>>,
    #[sqlx(skip)]
    pub series: Option<Series>,
    pub page_count: Option<i64>,
    pub language: Option<String>,
}

impl Metadata {
    pub fn is_empty(&self) -> bool {
        self.title.is_none()
            && self.subtitle.is_none()
            && self.description.is_none()
            && self.publisher.is_none()
            && self.publication_date.is_none()
            && self.isbn.is_none()
            && self.contributors.is_none()
            && self.genres.is_none()
            && self.series.is_none()
            && self.page_count.is_none()
            && self.language.is_none()
    }
}
