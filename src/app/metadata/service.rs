use super::models::{Metadata, MetadataError};
use crate::app::{error::ProsaError, metadata::repository};
use merge::Merge;
use uuid::Uuid;

pub async fn get_metadata(metadata_id: &str) -> Result<Metadata, ProsaError> {
    let metadata = repository::get_metadata(metadata_id).await?;
    Ok(metadata)
}

pub async fn add_metadata(metadata: Metadata) -> Result<String, ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    let metadata_id = Uuid::new_v4().to_string();
    repository::add_metadata(&metadata_id, &metadata).await?;
    Ok(metadata_id)
}

pub async fn delete_metadata(metadata_id: &str) -> Result<(), ProsaError> {
    repository::delete_metadata(metadata_id).await?;
    Ok(())
}

pub async fn patch_metadata(metadata_id: &str, mut metadata: Metadata) -> Result<(), ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    let original = repository::get_metadata(metadata_id).await?;
    metadata.merge(original);
    repository::update_metadata(metadata_id, &metadata).await?;
    Ok(())
}

pub async fn update_metadata(metadata_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    repository::update_metadata(metadata_id, &metadata).await?;
    Ok(())
}
