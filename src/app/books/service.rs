use super::models::{BookEntity, BookError, PaginatedBookResponse};
use crate::app::{books::repository, error::ProsaError};
use std::str::FromStr;
use uuid::Uuid;

pub async fn get_book(book_id: &str) -> Result<BookEntity, ProsaError> {
    let book = repository::get_book(book_id).await?;
    Ok(book)
}

pub async fn add_book(book: &BookEntity, book_id: Option<String>) -> Result<String, ProsaError> {
    let book_id = book_id
        .map(|id| Uuid::from_str(&id))
        .transpose()
        .map_err(|_| BookError::InvalidBookId)?
        .unwrap_or_else(Uuid::new_v4)
        .to_string();

    repository::add_book(&book_id, book).await?;
    Ok(book_id)
}

pub async fn update_book(book_id: &str, book: &BookEntity) -> Result<(), ProsaError> {
    repository::update_book(book_id, book).await?;
    Ok(())
}

pub async fn delete_book(book_id: &str) -> Result<(), ProsaError> {
    repository::delete_book(book_id).await?;
    Ok(())
}

pub async fn search_books(
    username: Option<String>,
    title: Option<String>,
    author: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedBookResponse, ProsaError> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(10);

    if page <= 0 || page_size <= 0 {
        return Err(BookError::InvalidPagination.into());
    }

    let result = repository::get_paginated_books(page, page_size, username, title, author).await;
    Ok(result)
}

pub async fn cover_is_in_use(cover_id: &str) -> bool {
    let books = repository::get_books_by_cover(cover_id).await;
    !books.is_empty()
}

pub async fn epub_is_in_use(epub_id: &str) -> bool {
    let books = repository::get_books_by_epub(epub_id).await;
    !books.is_empty()
}

pub async fn epub_is_in_use_by_user(epub_id: &str, user_id: &str) -> bool {
    repository::epub_belongs_to_user(epub_id, user_id).await
}

pub async fn book_exists(book_id: &str) -> bool {
    let book = repository::get_book(book_id).await;
    book.is_ok()
}
