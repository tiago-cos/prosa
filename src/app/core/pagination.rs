use crate::app::error::ProsaError;
use axum::extract::{FromRequestParts, Query};
use axum::http::request::Parts;
use std::collections::HashMap;
use strum_macros::{EnumMessage, EnumProperty};

#[derive(EnumMessage, EnumProperty, Debug)]
pub enum PaginationError {
    #[strum(message = "The requested pagination is invalid.")]
    #[strum(props(StatusCode = "400"))]
    InvalidPagination,
}

const DEFAULT_PAGE: i64 = 1;
const DEFAULT_SIZE: i64 = 10;

pub struct Pagination {
    pub page: i64,
    pub size: i64,
}

impl<S: Send + Sync> FromRequestParts<S> for Pagination {
    type Rejection = ProsaError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let Query(params) = Query::<HashMap<String, String>>::from_request_parts(parts, state)
            .await
            .map_err(|_| PaginationError::InvalidPagination)?;

        Ok(Self {
            page: read(&params, "page", DEFAULT_PAGE)?,
            size: read(&params, "size", DEFAULT_SIZE)?,
        })
    }
}

fn read(params: &HashMap<String, String>, name: &str, default: i64) -> Result<i64, PaginationError> {
    let Some(value) = params.get(name) else {
        return Ok(default);
    };

    match value.parse::<i64>() {
        Ok(value) if value > 0 => Ok(value),
        _ => Err(PaginationError::InvalidPagination),
    }
}
