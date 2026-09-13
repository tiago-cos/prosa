use super::models::{Metadata, MetadataError};
use crate::app::sync::models::{ChangeLogAction, ChangeLogEntityType};
use crate::app::{books, sync};
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

pub async fn add_metadata(book_id: &str, metadata: Metadata, session_id: &str) -> Result<(), ProsaError> {
    let book = books::service::get_book(book_id).await?;

    if metadata_exists(book_id).await {
        return Err(MetadataError::MetadataConflict.into());
    }

    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    let metadata_id = Uuid::new_v4().to_string();
    repository::add_metadata(pool(), &metadata_id, book_id, &metadata).await?;
    log_change(book_id, ChangeLogAction::Create, &book.owner_id, session_id).await;

    Ok(())
}

pub async fn delete_metadata(book_id: &str, session_id: &str) -> Result<(), ProsaError> {
    let book = books::service::get_book(book_id).await?;
    repository::delete_metadata(pool(), book_id).await?;
    log_change(book_id, ChangeLogAction::Delete, &book.owner_id, session_id).await;
    Ok(())
}

pub async fn patch_metadata(
    book_id: &str,
    mut metadata: Metadata,
    session_id: &str,
) -> Result<(), ProsaError> {
    let book = books::service::get_book(book_id).await?;

    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    let original = repository::get_metadata(pool(), book_id).await?;
    metadata.merge(original);

    repository::update_metadata(pool(), book_id, &metadata).await?;
    log_change(book_id, ChangeLogAction::Update, &book.owner_id, session_id).await;

    Ok(())
}

pub async fn update_metadata(book_id: &str, metadata: Metadata, session_id: &str) -> Result<(), ProsaError> {
    let book = books::service::get_book(book_id).await?;

    if metadata.is_empty() {
        return Err(MetadataError::InvalidMetadata.into());
    }

    repository::update_metadata(pool(), book_id, &metadata).await?;
    log_change(book_id, ChangeLogAction::Update, &book.owner_id, session_id).await;

    Ok(())
}

pub async fn store_metadata(book_id: &str, metadata: Metadata, session_id: &str) -> Result<(), ProsaError> {
    if metadata_exists(book_id).await {
        update_metadata(book_id, metadata, session_id).await
    } else {
        add_metadata(book_id, metadata, session_id).await
    };

    Ok(())
}

async fn log_change(book_id: &str, action: ChangeLogAction, owner_id: &str, session_id: &str) {
    sync::service::log_change(
        book_id,
        ChangeLogEntityType::BookMetadata,
        action,
        owner_id,
        session_id,
    )
    .await;
}
