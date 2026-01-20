use crate::app::{
    books,
    error::ProsaError,
    shelves::{
        models::{PaginatedShelves, Shelf, ShelfError, ShelfMetadata},
        repository,
    },
};
use uuid::Uuid;

pub async fn get_shelf(shelf_id: &str) -> Result<Shelf, ProsaError> {
    let shelf = repository::get_shelf(shelf_id).await?;
    Ok(shelf)
}

pub async fn get_shelf_metadata(shelf_id: &str) -> Result<ShelfMetadata, ProsaError> {
    let shelf = repository::get_shelf(shelf_id).await?;
    let book_count = repository::get_shelf_book_count(shelf_id).await;

    let metadata = ShelfMetadata {
        name: shelf.name,
        owner_id: shelf.owner_id,
        book_count,
    };

    Ok(metadata)
}

pub async fn add_shelf(shelf: Shelf) -> Result<String, ProsaError> {
    verify_shelf_name(&shelf.name)?;

    let old_shelf = repository::get_shelf_by_name_and_owner(&shelf.name, &shelf.owner_id).await;

    if old_shelf.is_some() {
        return Err(ShelfError::ShelfConflict.into());
    }

    let shelf_id = Uuid::new_v4().to_string();
    repository::add_shelf(&shelf_id, shelf).await?;

    Ok(shelf_id)
}

pub async fn update_shelf(shelf_id: &str, name: &str) -> Result<(), ProsaError> {
    verify_shelf_name(name)?;
    repository::update_shelf(shelf_id, name).await?;
    Ok(())
}

pub async fn delete_shelf(shelf_id: &str) -> Result<(), ProsaError> {
    repository::delete_shelf(shelf_id).await?;
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

    Ok(repository::get_paginated_shelves(page, page_size, username, name).await)
}

pub async fn add_book_to_shelf(shelf_id: &str, book_id: &str) -> Result<(), ProsaError> {
    // Verify if book and shelf exist
    books::service::get_book(book_id).await?;
    get_shelf_metadata(shelf_id).await?;

    repository::add_book_to_shelf(shelf_id, book_id).await?;
    Ok(())
}

pub async fn list_shelf_books(shelf_id: &str) -> Result<Vec<String>, ProsaError> {
    // Verify if the shelf exists
    get_shelf_metadata(shelf_id).await?;

    let books = repository::get_shelf_books(shelf_id).await;
    Ok(books)
}

pub async fn delete_book_from_shelf(shelf_id: &str, book_id: &str) -> Result<(), ProsaError> {
    // Verify if the shelf exists
    get_shelf_metadata(shelf_id).await?;

    repository::delete_book_from_shelf(shelf_id, book_id).await?;
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
