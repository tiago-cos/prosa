use super::{
    models::{Metadata, MetadataError},
    service,
};
use crate::app::{books, error::ProsaError, sync, Pool};
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};

pub async fn get_metadata_handler(
    State(pool): State<Pool>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let book = books::service::get_book(&pool, &book_id).await?;

    let metadata_id = match book.metadata_id {
        None => return Err(MetadataError::MetadataNotFound.into()),
        Some(id) => id,
    };

    let metadata = service::get_metadata(&pool, &metadata_id).await?;

    Ok(Json(metadata))
}

pub async fn add_metadata_handler(
    State(pool): State<Pool>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let mut book = books::service::get_book(&pool, &book_id).await?;
    let sync_id = book.sync_id.clone();

    let metadata_id = match book.metadata_id {
        None => service::add_metadata(&pool, metadata).await?,
        Some(_) => return Err(MetadataError::MetadataConflict.into()),
    };

    book.metadata_id = Some(metadata_id);
    books::service::update_book(&pool, &book_id, book).await?;

    sync::service::update_metadata_timestamp(&pool, &sync_id).await;

    Ok(())
}

pub async fn delete_metadata_handler(
    State(pool): State<Pool>,
    Path(book_id): Path<String>,
) -> Result<impl IntoResponse, ProsaError> {
    let book = books::service::get_book(&pool, &book_id).await?;

    let metadata_id = match book.metadata_id {
        None => return Err(MetadataError::MetadataNotFound.into()),
        Some(id) => id,
    };

    service::delete_metadata(&pool, &metadata_id).await?;

    sync::service::update_metadata_timestamp(&pool, &book.sync_id).await;

    Ok(())
}

pub async fn patch_metadata_handler(
    State(pool): State<Pool>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let mut book = books::service::get_book(&pool, &book_id).await?;
    let sync_id = book.sync_id.clone();

    let metadata_id = match book.metadata_id {
        None => return Err(MetadataError::MetadataNotFound.into()),
        Some(id) => id,
    };

    service::patch_metadata(&pool, &metadata_id, metadata).await?;

    // We need to reset the metadata_id because the update temporarily deletes the metadata, which causes the foreign key restriction to set the entry to null
    book.metadata_id = Some(metadata_id);
    books::service::update_book(&pool, &book_id, book).await?;

    sync::service::update_metadata_timestamp(&pool, &sync_id).await;

    Ok(())
}

pub async fn update_metadata_handler(
    State(pool): State<Pool>,
    Path(book_id): Path<String>,
    Json(metadata): Json<Metadata>,
) -> Result<impl IntoResponse, ProsaError> {
    let mut book = books::service::get_book(&pool, &book_id).await?;
    let sync_id = book.sync_id.clone();

    let metadata_id = match book.metadata_id {
        None => return Err(MetadataError::MetadataNotFound.into()),
        Some(id) => id,
    };

    service::update_metadata(&pool, &metadata_id, metadata).await?;

    // We need to reset the metadata_id because the update temporarily deletes the metadata, which causes the foreign key restriction to set the entry to null
    book.metadata_id = Some(metadata_id);
    books::service::update_book(&pool, &book_id, book).await?;

    sync::service::update_metadata_timestamp(&pool, &sync_id).await;

    Ok(())
}
