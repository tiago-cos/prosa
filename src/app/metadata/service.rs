use super::models::{Metadata, MetadataError};
use crate::app::{error::ProsaError, metadata::repository::MetadataRepository};
use merge::Merge;
use std::sync::Arc;
use uuid::Uuid;

pub struct MetadataService {
    metadata_repository: Arc<MetadataRepository>,
}

impl MetadataService {
    pub fn new(metadata_repository: Arc<MetadataRepository>) -> Self {
        Self { metadata_repository }
    }

    pub async fn get_metadata(&self, metadata_id: &str) -> Result<Metadata, ProsaError> {
        let metadata = self.metadata_repository.get_metadata(metadata_id).await?;
        Ok(metadata)
    }

    pub async fn add_metadata(&self, metadata: Metadata) -> Result<String, ProsaError> {
        if metadata.is_empty() {
            return Err(MetadataError::InvalidMetadata.into());
        }

        let metadata_id = Uuid::new_v4().to_string();
        self.metadata_repository
            .add_metadata(&metadata_id, &metadata)
            .await?;
        Ok(metadata_id)
    }

    pub async fn delete_metadata(&self, metadata_id: &str) -> Result<(), ProsaError> {
        self.metadata_repository.delete_metadata(metadata_id).await?;
        Ok(())
    }

    pub async fn patch_metadata(&self, metadata_id: &str, mut metadata: Metadata) -> Result<(), ProsaError> {
        if metadata.is_empty() {
            return Err(MetadataError::InvalidMetadata.into());
        }

        let original = self.metadata_repository.get_metadata(metadata_id).await?;
        metadata.merge(original);
        self.metadata_repository
            .update_metadata(metadata_id, &metadata)
            .await?;
        Ok(())
    }

    pub async fn update_metadata(&self, metadata_id: &str, metadata: Metadata) -> Result<(), ProsaError> {
        if metadata.is_empty() {
            return Err(MetadataError::InvalidMetadata.into());
        }

        self.metadata_repository
            .update_metadata(metadata_id, &metadata)
            .await?;
        Ok(())
    }
}
