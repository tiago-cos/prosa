use super::models::{Metadata, MetadataError};
use crate::app::{error::ProsaError, metadata::repository};
use crate::database::pool;
use merge::Merge;
use uuid::Uuid;

pub async fn get_metadata(book_id: &str) -> Result<Metadata, ProsaError> {
    let metadata = repository::get_metadata(pool(), book_id).await?;
    Ok(metadata)
}

pub async fn metadata_exists(book_id: &str) -> bool {
    repository::metadata_exists(pool(), book_id).await
}

pub async fn add_metadata(book_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    let metadata_id = Uuid::new_v4().to_string();
    repository::add_metadata(pool(), &metadata_id, book_id, &metadata).await?;
    Ok(())
}

pub async fn delete_metadata(book_id: &str) -> Result<(), ProsaError> {
    repository::delete_metadata(pool(), book_id).await?;
    Ok(())
}

pub async fn patch_metadata(book_id: &str, mut metadata: Metadata) -> Result<(), ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    let original = repository::get_metadata(pool(), book_id).await?;
    metadata.merge(original);
    repository::update_metadata(pool(), book_id, &metadata).await?;
    Ok(())
}

pub async fn update_metadata(book_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    repository::update_metadata(pool(), book_id, &metadata).await?;
    Ok(())
}
