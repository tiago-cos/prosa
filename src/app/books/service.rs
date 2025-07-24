use super::{
    data,
    models::{Book, BookError, PaginatedBooks},
};
use crate::app::error::ProsaError;
use sqlx::SqlitePool;
use uuid::Uuid;

pub async fn get_book(pool: &SqlitePool, book_id: &str) -> Result<Book, ProsaError> {
    let book = data::get_book(pool, book_id).await?;

    Ok(book)
}

pub async fn add_book(pool: &SqlitePool, book: Book) -> Result<String, ProsaError> {
    let book_id = Uuid::new_v4().to_string();
    data::add_book(pool, &book_id, book).await?;

    Ok(book_id)
}

pub async fn update_book(pool: &SqlitePool, book_id: &str, book: Book) -> Result<(), ProsaError> {
    data::update_book(pool, book_id, book).await?;

    Ok(())
}

pub async fn delete_book(pool: &SqlitePool, book_id: &str) -> Result<(), ProsaError> {
    data::delete_book(pool, book_id).await?;

    Ok(())
}

pub async fn search_books(
    pool: &SqlitePool,
    username: Option<String>,
    title: Option<String>,
    author: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedBooks, ProsaError> {
    let page = match page {
        None => 1,
        Some(page) => page,
    };

    let page_size = match page_size {
        None => 10,
        Some(page_size) => page_size,
    };

    if page <= 0 || page_size <= 0 {
        return Err(BookError::InvalidPagination.into());
    }

    Ok(data::get_paginated_books(pool, page, page_size, username, title, author).await)
}

pub async fn cover_is_in_use(pool: &SqlitePool, cover_id: &str) -> bool {
    let books = data::get_books_by_cover(pool, cover_id).await;
    !books.is_empty()
}

pub async fn epub_is_in_use(pool: &SqlitePool, epub_id: &str) -> bool {
    let books = data::get_books_by_epub(pool, epub_id).await;
    !books.is_empty()
}

pub async fn epub_is_in_use_by_user(pool: &SqlitePool, epub_id: &str, user_id: &str) -> bool {
    data::epub_belongs_to_user(pool, epub_id, user_id).await
}
