use super::models::{BookEntity, BookError, PaginatedBookResponse};
use crate::database::pool;

pub async fn get_book(book_id: &str) -> Result<BookEntity, BookError> {
    let book = sqlx::query_as::<_, BookEntity>(
        r"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id
        FROM books
        WHERE book_id = ?
        ",
    )
    .bind(book_id)
    .fetch_one(pool())
    .await?;

    Ok(book)
}

pub async fn add_book(book_id: &str, book: &BookEntity) -> Result<(), BookError> {
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
    .execute(pool())
    .await?;

    Ok(())
}

pub async fn delete_book(book_id: &str) -> Result<(), BookError> {
    let result = sqlx::query(
        r"
        DELETE FROM books
        WHERE book_id = ?
        ",
    )
    .bind(book_id)
    .execute(pool())
    .await?;

    if result.rows_affected() == 0 {
        return Err(BookError::BookNotFound);
    }

    Ok(())
}

pub async fn update_book(book_id: &str, book: &BookEntity) -> Result<(), BookError> {
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
    .execute(pool())
    .await?;

    if result.rows_affected() == 0 {
        return Err(BookError::BookNotFound);
    }

    Ok(())
}

pub async fn get_books_by_cover(cover_id: &str) -> Vec<BookEntity> {
    sqlx::query_as::<_, BookEntity>(
        r"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id
        FROM books
        WHERE cover_id = ?
        ",
    )
    .bind(cover_id)
    .fetch_all(pool())
    .await
    .expect("Failed to retrieve books by cover")
}

pub async fn get_books_by_epub(epub_id: &str) -> Vec<BookEntity> {
    sqlx::query_as::<_, BookEntity>(
        r"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id
        FROM books
        WHERE epub_id = ?
        ",
    )
    .bind(epub_id)
    .fetch_all(pool())
    .await
    .expect("Failed to retrieve books by epub")
}

pub async fn epub_belongs_to_user(epub_id: &str, user_id: &str) -> bool {
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
    .fetch_optional(pool())
    .await
    .expect("Failed to verify if epub belongs to user");

    exists.is_some()
}

pub async fn get_paginated_books(
    page: i64,
    page_size: i64,
    username: Option<String>,
    title: Option<String>,
    author: Option<String>,
) -> PaginatedBookResponse {
    let offset = (page - 1) * page_size;

    let mut book_query = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
        r"
        SELECT DISTINCT b.book_id
        FROM books b
        INNER JOIN users u ON b.owner_id = u.user_id
        LEFT JOIN metadata m ON b.metadata_id = m.metadata_id
        LEFT JOIN contributors c ON b.metadata_id = c.metadata_id
        WHERE 1=1
        ",
    );

    let mut count_query = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
        r"
        SELECT COUNT(DISTINCT b.book_id)
        FROM books b
        INNER JOIN users u ON b.owner_id = u.user_id
        LEFT JOIN metadata m ON b.metadata_id = m.metadata_id
        LEFT JOIN contributors c ON b.metadata_id = c.metadata_id
        WHERE 1=1
        ",
    );

    if let Some(username) = username {
        book_query.push(" AND u.username = ").push_bind(&username);

        count_query.push(" AND u.username = ").push_bind(username);
    }

    if let Some(title) = title {
        book_query
            .push(" AND m.title LIKE '%' || ")
            .push_bind(&title)
            .push(" || '%' COLLATE NOCASE");

        count_query
            .push(" AND m.title LIKE '%' || ")
            .push_bind(title)
            .push(" || '%' COLLATE NOCASE");
    }

    if let Some(author) = author {
        book_query
            .push(" AND c.name LIKE '%' || ")
            .push_bind(&author)
            .push(" || '%' COLLATE NOCASE");

        count_query
            .push(" AND c.name LIKE '%' || ")
            .push_bind(author)
            .push(" || '%' COLLATE NOCASE");
    }

    book_query
        .push(" ORDER BY b.book_id LIMIT ")
        .push_bind(page_size)
        .push(" OFFSET ")
        .push_bind(offset);

    let book_ids = book_query
        .build_query_scalar::<String>()
        .fetch_all(pool())
        .await
        .expect("Failed to search for books");

    let total_elements = count_query
        .build_query_scalar::<i64>()
        .fetch_one(pool())
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
