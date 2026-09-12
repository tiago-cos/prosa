use crate::app::{
    books,
    core::ids,
    error::ProsaError,
    server::LOCKS,
    shelves::{
        models::{PaginatedShelves, Shelf, ShelfError, ShelfMetadata},
        repository,
    },
    sync::{
        self,
        models::{ChangeLogAction, ChangeLogEntityType},
    },
};
use crate::database::pool;

pub async fn get_shelf(shelf_id: &str) -> Result<Shelf, ProsaError> {
    let shelf = repository::get_shelf(pool(), shelf_id).await?;
    Ok(shelf)
}

pub async fn get_shelf_metadata(shelf_id: &str) -> Result<ShelfMetadata, ProsaError> {
    let shelf = repository::get_shelf(pool(), shelf_id).await?;
    let book_count = repository::get_shelf_book_count(pool(), shelf_id).await;

    let metadata = ShelfMetadata {
        name: shelf.name,
        owner_id: shelf.owner_id,
        book_count,
    };

    Ok(metadata)
}

pub async fn add_shelf(
    shelf: Shelf,
    shelf_id: Option<String>,
    session_id: &str,
) -> Result<String, ProsaError> {
    verify_shelf_name(&shelf.name)?;

    let shelf_id = ids::resolve(shelf_id).map_err(|_| ShelfError::InvalidShelfId)?;

    let lock = LOCKS.get_shelf_lock(&shelf_id).await;
    let _guard = lock.write().await;

    if repository::shelf_exists(pool(), &shelf_id).await {
        return Err(ShelfError::ShelfIdConflict.into());
    }

    let old_shelf = repository::get_shelf_by_name_and_owner(pool(), &shelf.name, &shelf.owner_id).await;

    if old_shelf.is_some() {
        return Err(ShelfError::ShelfConflict.into());
    }

    let owner_id = shelf.owner_id.clone();
    repository::add_shelf(pool(), &shelf_id, shelf).await?;
    log_metadata_change(&shelf_id, ChangeLogAction::Create, &owner_id, session_id).await;

    Ok(shelf_id)
}

pub async fn update_shelf(shelf_id: &str, name: &str, session_id: &str) -> Result<(), ProsaError> {
    verify_shelf_name(name)?;
    let shelf = repository::get_shelf(pool(), shelf_id).await?;
    repository::update_shelf(pool(), shelf_id, name).await?;
    log_metadata_change(shelf_id, ChangeLogAction::Update, &shelf.owner_id, session_id).await;
    Ok(())
}

pub async fn delete_shelf(shelf_id: &str, session_id: &str) -> Result<(), ProsaError> {
    let shelf = repository::get_shelf(pool(), shelf_id).await?;
    repository::delete_shelf(pool(), shelf_id).await?;
    log_metadata_change(shelf_id, ChangeLogAction::Delete, &shelf.owner_id, session_id).await;
    Ok(())
}

pub async fn search_shelves(
    username: Option<String>,
    name: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedShelves, ProsaError> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(10);

    if page <= 0 || page_size <= 0 {
        return Err(ShelfError::InvalidPagination.into());
    }

    Ok(repository::get_paginated_shelves(pool(), page, page_size, username, name).await)
}

pub async fn add_book_to_shelf(shelf_id: &str, book_id: &str, session_id: &str) -> Result<(), ProsaError> {
    books::service::get_book(book_id).await?;
    let shelf = repository::get_shelf(pool(), shelf_id).await?;
    repository::add_book_to_shelf(pool(), shelf_id, book_id).await?;
    log_content_change(shelf_id, ChangeLogAction::Create, &shelf.owner_id, session_id).await;
    Ok(())
}

pub async fn list_shelf_books(shelf_id: &str) -> Result<Vec<String>, ProsaError> {
    verify_shelf_exists(shelf_id).await?;
    let books = repository::get_shelf_books(pool(), shelf_id).await;
    Ok(books)
}

pub async fn delete_book_from_shelf(
    shelf_id: &str,
    book_id: &str,
    session_id: &str,
) -> Result<(), ProsaError> {
    let shelf = repository::get_shelf(pool(), shelf_id).await?;
    repository::delete_book_from_shelf(pool(), shelf_id, book_id).await?;
    log_content_change(shelf_id, ChangeLogAction::Delete, &shelf.owner_id, session_id).await;
    Ok(())
}

fn verify_shelf_name(name: &str) -> Result<(), ShelfError> {
    if !name.chars().all(|c| (' '..='~').contains(&c)) {
        return Err(ShelfError::InvalidName);
    }

    if name.len() > 30 {
        return Err(ShelfError::InvalidName);
    }

    Ok(())
}

async fn verify_shelf_exists(shelf_id: &str) -> Result<(), ProsaError> {
    if !repository::shelf_exists(pool(), shelf_id).await {
        return Err(ShelfError::ShelfNotFound.into());
    }

    Ok(())
}

async fn log_metadata_change(shelf_id: &str, action: ChangeLogAction, owner_id: &str, session_id: &str) {
    sync::service::log_change(
        shelf_id,
        ChangeLogEntityType::ShelfMetadata,
        action,
        owner_id,
        session_id,
    )
    .await;
}

async fn log_content_change(shelf_id: &str, action: ChangeLogAction, owner_id: &str, session_id: &str) {
    sync::service::log_change(
        shelf_id,
        ChangeLogEntityType::ShelfContent,
        action,
        owner_id,
        session_id,
    )
    .await;
}
