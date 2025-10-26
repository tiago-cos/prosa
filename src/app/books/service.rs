use super::{
    data,
    models::{Book, BookError, PaginatedBooks},
};
use crate::app::error::ProsaError;
use sqlx::SqlitePool;
use uuid::Uuid;

pub struct BookService {
    pool: SqlitePool,
}

impl BookService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_book(&self, book_id: &str) -> Result<Book, ProsaError> {
        let book = data::get_book(&self.pool, book_id).await?;
        Ok(book)
    }

    pub async fn add_book(&self, book: Book) -> Result<String, ProsaError> {
        let book_id = Uuid::new_v4().to_string();
        data::add_book(&self.pool, &book_id, book).await?;
        Ok(book_id)
    }

    pub async fn update_book(&self, book_id: &str, book: Book) -> Result<(), ProsaError> {
        data::update_book(&self.pool, book_id, book).await?;
        Ok(())
    }

    pub async fn delete_book(&self, book_id: &str) -> Result<(), ProsaError> {
        data::delete_book(&self.pool, book_id).await?;
        Ok(())
    }

    pub async fn search_books(
        &self,
        username: Option<String>,
        title: Option<String>,
        author: Option<String>,
        page: Option<i64>,
        page_size: Option<i64>,
    ) -> Result<PaginatedBooks, ProsaError> {
        let page = page.unwrap_or(1);
        let page_size = page_size.unwrap_or(10);

        if page <= 0 || page_size <= 0 {
            return Err(BookError::InvalidPagination.into());
        }

        Ok(data::get_paginated_books(&self.pool, page, page_size, username, title, author).await)
    }

    pub async fn cover_is_in_use(&self, cover_id: &str) -> bool {
        let books = data::get_books_by_cover(&self.pool, cover_id).await;
        !books.is_empty()
    }

    pub async fn epub_is_in_use(&self, epub_id: &str) -> bool {
        let books = data::get_books_by_epub(&self.pool, epub_id).await;
        !books.is_empty()
    }

    pub async fn epub_is_in_use_by_user(&self, epub_id: &str, user_id: &str) -> bool {
        data::epub_belongs_to_user(&self.pool, epub_id, user_id).await
    }
}
