use super::models::{BookEntity, BookError, PaginatedBookResponse};
use sqlx::SqlitePool;

pub struct BookRepository {
    pool: SqlitePool,
}

impl BookRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_book(&self, book_id: &str) -> Result<BookEntity, BookError> {
        let book = sqlx::query_as::<_, BookEntity>(
            r"
            SELECT owner_id, epub_id, metadata_id, cover_id, state_id
            FROM books
            WHERE book_id = ?
            ",
        )
        .bind(book_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(book)
    }

    pub async fn add_book(&self, book_id: &str, book: &BookEntity) -> Result<(), BookError> {
        sqlx::query(
            r"
            INSERT INTO books (book_id, owner_id, epub_id, metadata_id, cover_id, state_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ",
        )
        .bind(book_id)
        .bind(&book.owner_id)
        .bind(&book.epub_id)
        .bind(&book.metadata_id)
        .bind(&book.cover_id)
        .bind(&book.state_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn delete_book(&self, book_id: &str) -> Result<(), BookError> {
        let result = sqlx::query(
            r"
            DELETE FROM books
            WHERE book_id = ?
            ",
        )
        .bind(book_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(BookError::BookNotFound);
        }

        Ok(())
    }

    pub async fn update_book(&self, book_id: &str, book: &BookEntity) -> Result<(), BookError> {
        let result = sqlx::query(
            r"
            UPDATE books
            SET owner_id = ?, epub_id = ?, metadata_id = ?, cover_id = ?, state_id = ?
            WHERE book_id = ?
            ",
        )
        .bind(&book.owner_id)
        .bind(&book.epub_id)
        .bind(&book.metadata_id)
        .bind(&book.cover_id)
        .bind(&book.state_id)
        .bind(book_id)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(BookError::BookNotFound);
        }

        Ok(())
    }

    pub async fn get_books_by_cover(&self, cover_id: &str) -> Vec<BookEntity> {
        sqlx::query_as::<_, BookEntity>(
            r"
            SELECT owner_id, epub_id, metadata_id, cover_id, state_id
            FROM books
            WHERE cover_id = ?
            ",
        )
        .bind(cover_id)
        .fetch_all(&self.pool)
        .await
        .expect("Failed to retrieve books by cover")
    }

    pub async fn get_books_by_epub(&self, epub_id: &str) -> Vec<BookEntity> {
        sqlx::query_as::<_, BookEntity>(
            r"
            SELECT owner_id, epub_id, metadata_id, cover_id, state_id
            FROM books
            WHERE epub_id = ?
            ",
        )
        .bind(epub_id)
        .fetch_all(&self.pool)
        .await
        .expect("Failed to retrieve books by epub")
    }

    pub async fn epub_belongs_to_user(&self, epub_id: &str, user_id: &str) -> bool {
        let exists = sqlx::query_scalar::<_, i64>(
            r"
            SELECT 1
            FROM books
            WHERE epub_id = ? AND owner_id = ?
            LIMIT 1
            ",
        )
        .bind(epub_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .expect("Failed to verify if epub belongs to user");

        exists.is_some()
    }

    pub async fn get_paginated_books(
        &self,
        page: i64,
        page_size: i64,
        username: Option<String>,
        title: Option<String>,
        author: Option<String>,
    ) -> PaginatedBookResponse {
        let offset = (page - 1) * page_size;

        let mut bind_params: Vec<String> = Vec::new();
        let mut base_query = r"
            FROM books b
            INNER JOIN users u ON b.owner_id = u.user_id
            LEFT JOIN metadata m ON b.metadata_id = m.metadata_id
            LEFT JOIN contributors c ON b.metadata_id = c.metadata_id
            WHERE 1=1
        "
        .to_string();

        if let Some(name) = username {
            base_query.push_str(" AND u.username = ?");
            bind_params.push(name);
        }
        if let Some(title) = title {
            base_query.push_str(" AND m.title LIKE '%' || ? || '%' COLLATE NOCASE");
            bind_params.push(title);
        }
        if let Some(author) = author {
            base_query.push_str(" AND c.name LIKE '%' || ? || '%' COLLATE NOCASE");
            bind_params.push(author);
        }

        let book_query =
            format!("SELECT DISTINCT b.book_id {base_query} ORDER BY b.book_id LIMIT ? OFFSET ?");
        let count_query = format!("SELECT COUNT(DISTINCT b.book_id) {base_query}");

        let mut book_stmt = sqlx::query_scalar::<_, String>(&book_query);
        let mut count_stmt = sqlx::query_scalar::<_, i64>(&count_query);

        for param in &bind_params {
            book_stmt = book_stmt.bind(param);
            count_stmt = count_stmt.bind(param);
        }

        book_stmt = book_stmt.bind(page_size).bind(offset);

        let book_ids = book_stmt
            .fetch_all(&self.pool)
            .await
            .expect("Failed to search for books");

        let total_elements = count_stmt
            .fetch_one(&self.pool)
            .await
            .expect("Failed to count books");

        let total_pages = (total_elements + page_size - 1) / page_size;

        PaginatedBookResponse {
            book_ids,
            page_size,
            total_elements,
            total_pages,
            current_page: page,
        }
    }
}
