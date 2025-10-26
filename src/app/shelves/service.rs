use super::data;
use crate::app::{
    books::service::BookService,
    error::ProsaError,
    shelves::models::{PaginatedShelves, Shelf, ShelfError, ShelfMetadata},
};
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn get_shelf(pool: &SqlitePool, shelf_id: &str) -> Result<Shelf, ProsaError> {
    let shelf = data::get_shelf(pool, shelf_id).await?;

    Ok(shelf)
}

pub async fn get_shelf_by_name_and_owner(
    pool: &SqlitePool,
    shelf_name: &str,
    owner_id: &str,
) -> Option<Shelf> {
    data::get_shelf_by_name_and_owner(pool, shelf_name, owner_id).await
}

pub async fn get_shelf_metadata(pool: &SqlitePool, shelf_id: &str) -> Result<ShelfMetadata, ProsaError> {
    let shelf = data::get_shelf(pool, shelf_id).await?;
    let book_count = data::get_shelf_book_count(pool, shelf_id).await;

    let metadata = ShelfMetadata {
        name: shelf.name,
        owner_id: shelf.owner_id,
        book_count,
    };

    Ok(metadata)
}

pub async fn add_shelf(pool: &SqlitePool, shelf: Shelf) -> Result<String, ProsaError> {
    verify_shelf_name(&shelf.name)?;

    let shelf_id = Uuid::new_v4().to_string();
    data::add_shelf(pool, &shelf_id, shelf).await?;

    Ok(shelf_id)
}

pub async fn update_shelf(pool: &SqlitePool, shelf_id: &str, name: &str) -> Result<(), ProsaError> {
    verify_shelf_name(name)?;
    data::update_shelf(pool, shelf_id, name).await?;

    Ok(())
}

pub async fn delete_shelf(pool: &SqlitePool, shelf_id: &str) -> Result<(), ProsaError> {
    data::delete_shelf(pool, shelf_id).await?;

    Ok(())
}

pub async fn search_shelves(
    pool: &SqlitePool,
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

    Ok(data::get_paginated_shelves(pool, page, page_size, username, name).await)
}

pub async fn add_book_to_shelf(
    books: &BookService,
    pool: &SqlitePool,
    shelf_id: &str,
    book_id: &str,
) -> Result<(), ProsaError> {
    // Verify if book and shelf exist
    books.get_book(book_id).await?;
    get_shelf_metadata(pool, shelf_id).await?;

    data::add_book_to_shelf(pool, shelf_id, book_id).await?;

    Ok(())
}

pub async fn list_shelf_books(pool: &SqlitePool, shelf_id: &str) -> Result<Vec<String>, ProsaError> {
    // Verify if the shelf exists
    get_shelf_metadata(pool, shelf_id).await?;

    let books = data::get_shelf_books(pool, shelf_id).await;

    Ok(books)
}

pub async fn delete_book_from_shelf(
    pool: &SqlitePool,
    shelf_id: &str,
    book_id: &str,
) -> Result<(), ProsaError> {
    // Verify if the shelf exists
    get_shelf_metadata(pool, shelf_id).await?;

    data::delete_book_from_shelf(pool, shelf_id, book_id).await?;

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
