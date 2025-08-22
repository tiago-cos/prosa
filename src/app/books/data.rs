use super::models::{Book, BookError, PaginatedBooks};
use sqlx::SqlitePool;

pub async fn get_book(pool: &SqlitePool, book_id: &str) -> Result<Book, BookError> {
    let book: Book = sqlx::query_as(
        r"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id, book_sync_id
        FROM books
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_one(pool)
    .await?;

    Ok(book)
}

pub async fn add_book(pool: &SqlitePool, book_id: &str, book: Book) -> Result<(), BookError> {
    sqlx::query(
        r"
        INSERT INTO books (book_id, owner_id, epub_id, metadata_id, cover_id, state_id, book_sync_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
        ",
    )
    .bind(book_id)
    .bind(book.owner_id)
    .bind(book.epub_id)
    .bind(book.metadata_id)
    .bind(book.cover_id)
    .bind(book.state_id)
    .bind(book.book_sync_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_book(pool: &SqlitePool, book_id: &str) -> Result<(), BookError> {
    let book: Book = sqlx::query_as(
        r"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id, book_sync_id
        FROM books
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_one(pool)
    .await?;

    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        r"
        DELETE FROM books
        WHERE book_id = $1;
        ",
    )
    .bind(book_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(BookError::BookNotFound);
    }

    sqlx::query(
        r"
        INSERT INTO deleted_books (book_id, book_sync_id, owner_id)
        VALUES ($1, $2, $3);
        ",
    )
    .bind(book_id)
    .bind(book.book_sync_id)
    .bind(book.owner_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

pub async fn update_book(pool: &SqlitePool, book_id: &str, book: Book) -> Result<(), BookError> {
    let result = sqlx::query(
        r"
        UPDATE books
        SET owner_id = $1, epub_id = $2, metadata_id = $3, cover_id = $4, state_id = $5, book_sync_id = $6
        WHERE book_id = $7;
        ",
    )
    .bind(book.owner_id)
    .bind(book.epub_id)
    .bind(book.metadata_id)
    .bind(book.cover_id)
    .bind(book.state_id)
    .bind(book.book_sync_id)
    .bind(book_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(BookError::BookNotFound);
    }

    Ok(())
}

pub async fn get_books_by_cover(pool: &SqlitePool, cover_id: &str) -> Vec<Book> {
    let books: Vec<Book> = sqlx::query_as(
        r"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id, book_sync_id
        FROM books
        WHERE cover_id = $1
        ",
    )
    .bind(cover_id)
    .fetch_all(pool)
    .await
    .expect("Failed to retrieve books with given cover");

    books
}

pub async fn get_books_by_epub(pool: &SqlitePool, epub_id: &str) -> Vec<Book> {
    let books: Vec<Book> = sqlx::query_as(
        r"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id, book_sync_id
        FROM books
        WHERE epub_id = $1
        ",
    )
    .bind(epub_id)
    .fetch_all(pool)
    .await
    .expect("Failed to retrieve books with given epub");

    books
}

pub async fn get_paginated_books(
    pool: &SqlitePool,
    page: i64,
    page_size: i64,
    username: Option<String>,
    title: Option<String>,
    author: Option<String>,
) -> PaginatedBooks {
    let offset = (page - 1) * page_size;

    let mut bind_params: Vec<String> = Vec::new();

    let mut book_query = String::from(
        r"
        SELECT DISTINCT book_id
        FROM books b
        INNER JOIN users u ON b.owner_id = u.user_id
        LEFT JOIN metadata m ON b.metadata_id = m.metadata_id
        LEFT JOIN contributors c ON b.metadata_id = c.metadata_id
        WHERE 1=1
        ",
    );

    let mut count_query = String::from(
        r"
        SELECT COUNT(DISTINCT book_id)
        FROM books b
        INNER JOIN users u ON b.owner_id = u.user_id
        LEFT JOIN metadata m ON b.metadata_id = m.metadata_id
        LEFT JOIN contributors c ON b.metadata_id = c.metadata_id
        WHERE 1=1
        ",
    );

    if let Some(name) = username {
        let part = format!(" AND u.username = ${}", bind_params.len() + 1);
        book_query.push_str(&part);
        count_query.push_str(&part);
        bind_params.push(name);
    }

    if let Some(title) = title {
        let part = format!(
            " AND m.title LIKE '%' || ${} || '%' COLLATE NOCASE",
            bind_params.len() + 1
        );
        book_query.push_str(&part);
        count_query.push_str(&part);
        bind_params.push(title);
    }

    if let Some(author) = author {
        let part = format!(
            " AND c.name LIKE '%' || ${} || '%' COLLATE NOCASE",
            bind_params.len() + 1
        );
        book_query.push_str(&part);
        count_query.push_str(&part);
        bind_params.push(author);
    }

    let part = format!(
        " ORDER BY b.book_id LIMIT ${} OFFSET ${}",
        bind_params.len() + 1,
        bind_params.len() + 2
    );
    book_query.push_str(&part);

    let mut book_ids = sqlx::query_scalar(&book_query);
    let mut total_elements = sqlx::query_scalar(&count_query);

    for param in bind_params {
        book_ids = book_ids.bind(param.clone());
        total_elements = total_elements.bind(param);
    }

    book_ids = book_ids.bind(page_size).bind(offset);

    let book_ids = book_ids
        .fetch_all(pool)
        .await
        .expect("Failed to search for books");

    let total_elements = total_elements
        .fetch_one(pool)
        .await
        .expect("Failed to count books");

    let total_pages = (total_elements + page_size - 1) / page_size;

    PaginatedBooks {
        book_ids,
        page_size,
        total_elements,
        total_pages,
        current_page: page,
    }
}

pub async fn epub_belongs_to_user(pool: &SqlitePool, epub_id: &str, user_id: &str) -> bool {
    let exists = sqlx::query_scalar::<_, Option<i64>>(
        r"
        SELECT 1 FROM books
        WHERE epub_id = $1 AND owner_id = $2
        LIMIT 1
        ",
    )
    .bind(epub_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .expect("Failed to verify if epub belongs to user");

    exists.is_some()
}
