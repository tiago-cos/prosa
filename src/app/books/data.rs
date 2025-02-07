use super::models::{Book, BookError};
use sqlx::SqlitePool;

pub async fn get_book(pool: &SqlitePool, book_id: &str) -> Result<Book, BookError> {
    let book: Book = sqlx::query_as(
        r#"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id, sync_id
        FROM books
        WHERE book_id = $1
        "#,
    )
    .bind(book_id)
    .fetch_one(pool)
    .await?;

    Ok(book)
}

pub async fn add_book(pool: &SqlitePool, book_id: &str, book: Book) -> Result<(), BookError> {
    sqlx::query(
        r#"
        INSERT INTO books (book_id, owner_id, epub_id, metadata_id, cover_id, state_id, sync_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
        "#,
    )
    .bind(book_id)
    .bind(book.owner_id)
    .bind(book.epub_id)
    .bind(book.metadata_id)
    .bind(book.cover_id)
    .bind(book.state_id)
    .bind(book.sync_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_book(pool: &SqlitePool, book_id: &str) -> Result<(), BookError> {
    let book: Book = sqlx::query_as(
        r#"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id, sync_id
        FROM books
        WHERE book_id = $1
        "#,
    )
    .bind(book_id)
    .fetch_one(pool)
    .await?;

    let result = sqlx::query(
        r#"
        DELETE FROM books
        WHERE book_id = $1;
        "#,
    )
    .bind(book_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(BookError::BookNotFound);
    }

    sqlx::query(
        r#"
        INSERT INTO deleted_books (book_id, sync_id, owner_id)
        VALUES ($1, $2, $3);
        "#,
    )
    .bind(book_id)
    .bind(book.sync_id)
    .bind(book.owner_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_book(pool: &SqlitePool, book_id: &str, book: Book) -> Result<(), BookError> {
    let result = sqlx::query(
        r#"
        UPDATE books
        SET owner_id = $1, epub_id = $2, metadata_id = $3, cover_id = $4, state_id = $5, sync_id = $6
        WHERE book_id = $7;
        "#,
    )
    .bind(book.owner_id)
    .bind(book.epub_id)
    .bind(book.metadata_id)
    .bind(book.cover_id)
    .bind(book.state_id)
    .bind(book.sync_id)
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
        r#"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id, sync_id
        FROM books
        WHERE cover_id = $1
        "#,
    )
    .bind(cover_id)
    .fetch_all(pool)
    .await
    .expect("Failed to retrieve books with given cover");

    books
}

pub async fn get_books_by_epub(pool: &SqlitePool, epub_id: &str) -> Vec<Book> {
    let books: Vec<Book> = sqlx::query_as(
        r#"
        SELECT owner_id, epub_id, metadata_id, cover_id, state_id, sync_id
        FROM books
        WHERE epub_id = $1
        "#,
    )
    .bind(epub_id)
    .fetch_all(pool)
    .await
    .expect("Failed to retrieve books with given epub");

    books
}
