use super::{
    data,
    models::{Metadata, MetadataError},
};
use crate::app::error::ProsaError;
use merge::Merge;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn get_metadata(pool: &SqlitePool, metadata_id: &str) -> Result<Metadata, ProsaError> {
    let metadata = data::get_metadata(pool, metadata_id).await?;

    Ok(metadata)
}

pub async fn add_metadata(pool: &SqlitePool, metadata: Metadata) -> Result<String, ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    let metadata_id = Uuid::new_v4().to_string();
    data::add_metadata(pool, &metadata_id, metadata).await?;

    Ok(metadata_id)
}

pub async fn delete_metadata(pool: &SqlitePool, metadata_id: &str) -> Result<(), ProsaError> {
    data::delete_metadata(pool, metadata_id).await?;

    Ok(())
}

pub async fn patch_metadata(
    pool: &SqlitePool,
    metadata_id: &str,
    mut metadata: Metadata,
) -> Result<(), ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    let original = data::get_metadata(pool, metadata_id).await?;
    metadata.merge(original);
    data::delete_metadata(pool, metadata_id).await?;
    data::add_metadata(pool, metadata_id, metadata).await?;

    Ok(())
}

pub async fn update_metadata(
    pool: &SqlitePool,
    metadata_id: &str,
    metadata: Metadata,
) -> Result<(), ProsaError> {
    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    data::delete_metadata(pool, metadata_id).await?;
    data::add_metadata(pool, metadata_id, metadata).await?;

    Ok(())
}
