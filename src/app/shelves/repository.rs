use super::models::{Shelf, ShelfError};
use crate::app::shelves::models::{PaginatedShelves, ShelfBookError};
use sqlx::{Acquire, Sqlite, SqliteExecutor};

pub async fn get_shelf<'e>(db: impl SqliteExecutor<'e>, shelf_id: &str) -> Result<Shelf, ShelfError> {
    let shelf: Shelf = sqlx::query_as(
        r"
        SELECT name, owner_id
        FROM shelf
        WHERE shelf_id = $1
        ",
    )
    .bind(shelf_id)
    .fetch_one(db)
    .await?;

    Ok(shelf)
}

pub async fn get_shelf_by_name_and_owner<'e>(
    db: impl SqliteExecutor<'e>,
    name: &str,
    owner_id: &str,
) -> Option<Shelf> {
    sqlx::query_as(
        r"
        SELECT name, owner_id
        FROM shelf
        WHERE name = $1 AND owner_id = $2
        ",
    )
    .bind(name)
    .bind(owner_id)
    .fetch_optional(db)
    .await
    .expect("Failed to fetch shelf by name and owner")
}

pub async fn add_shelf<'e>(
    db: impl SqliteExecutor<'e>,
    shelf_id: &str,
    shelf: Shelf,
) -> Result<(), ShelfError> {
    sqlx::query(
        r"
        INSERT INTO shelf (shelf_id, name, owner_id)
        VALUES ($1, $2, $3);
        ",
    )
    .bind(shelf_id)
    .bind(shelf.name)
    .bind(shelf.owner_id)
    .execute(db)
    .await?;

    Ok(())
}

pub async fn delete_shelf<'e>(db: impl SqliteExecutor<'e>, shelf_id: &str) -> Result<(), ShelfError> {
    let result = sqlx::query(
        r"
        DELETE FROM shelf
        WHERE shelf_id = $1;
        ",
    )
    .bind(shelf_id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ShelfError::ShelfNotFound);
    }

    Ok(())
}

pub async fn update_shelf<'e>(
    db: impl SqliteExecutor<'e>,
    shelf_id: &str,
    name: &str,
) -> Result<(), ShelfError> {
    let result = sqlx::query(
        r"
        UPDATE shelf
        SET name = $1
        WHERE shelf_id = $2;
        ",
    )
    .bind(name)
    .bind(shelf_id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ShelfError::ShelfNotFound);
    }

    Ok(())
}

pub async fn get_paginated_shelves<'a>(
    db: impl Acquire<'a, Database = Sqlite>,
    page: i64,
    page_size: i64,
    username: Option<String>,
    name: Option<String>,
) -> PaginatedShelves {
    let offset = (page - 1) * page_size;

    let mut conn = db.acquire().await.expect("Failed to acquire connection");

    let mut shelf_query = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
        r"
        SELECT DISTINCT s.shelf_id
        FROM shelf s
        INNER JOIN users u ON s.owner_id = u.user_id
        WHERE 1=1
        ",
    );

    let mut count_query = sqlx::QueryBuilder::<sqlx::Sqlite>::new(
        r"
        SELECT COUNT(DISTINCT s.shelf_id)
        FROM shelf s
        INNER JOIN users u ON s.owner_id = u.user_id
        WHERE 1=1
        ",
    );

    if let Some(username) = username {
        shelf_query.push(" AND u.username = ").push_bind(&username);

        count_query.push(" AND u.username = ").push_bind(username);
    }

    if let Some(name) = name {
        shelf_query
            .push(" AND s.name LIKE '%' || ")
            .push_bind(&name)
            .push(" || '%' COLLATE NOCASE");

        count_query
            .push(" AND s.name LIKE '%' || ")
            .push_bind(name)
            .push(" || '%' COLLATE NOCASE");
    }

    shelf_query
        .push(" ORDER BY s.shelf_id LIMIT ")
        .push_bind(page_size)
        .push(" OFFSET ")
        .push_bind(offset);

    let shelf_ids = shelf_query
        .build_query_scalar::<String>()
        .fetch_all(&mut *conn)
        .await
        .expect("Failed to search for shelves");

    let total_elements = count_query
        .build_query_scalar::<i64>()
        .fetch_one(&mut *conn)
        .await
        .expect("Failed to count shelves");

    let total_pages = (total_elements + page_size - 1) / page_size;

    PaginatedShelves {
        shelf_ids,
        page_size,
        total_elements,
        total_pages,
        current_page: page,
    }
}

pub async fn get_shelf_book_count<'e>(db: impl SqliteExecutor<'e>, shelf_id: &str) -> i64 {
    let count: (i64,) = sqlx::query_as(
        r"
        SELECT COUNT(book_id)
        FROM is_in_shelf
        WHERE shelf_id = $1
        ",
    )
    .bind(shelf_id)
    .fetch_one(db)
    .await
    .expect("Failed to count books in shelf");

    count.0
}

pub async fn add_book_to_shelf<'e>(
    db: impl SqliteExecutor<'e>,
    shelf_id: &str,
    book_id: &str,
) -> Result<(), ShelfBookError> {
    sqlx::query(
        r"
        INSERT INTO is_in_shelf (shelf_id, book_id)
        VALUES ($1, $2);
        ",
    )
    .bind(shelf_id)
    .bind(book_id)
    .execute(db)
    .await?;

    Ok(())
}

pub async fn get_shelf_books<'e>(db: impl SqliteExecutor<'e>, shelf_id: &str) -> Vec<String> {
    sqlx::query_scalar(
        r"
        SELECT book_id
        FROM is_in_shelf
        WHERE shelf_id = $1
        ",
    )
    .bind(shelf_id)
    .fetch_all(db)
    .await
    .expect("Failed to list shelf books")
}

pub async fn delete_book_from_shelf<'e>(
    db: impl SqliteExecutor<'e>,
    shelf_id: &str,
    book_id: &str,
) -> Result<(), ShelfBookError> {
    let result = sqlx::query(
        r"
        DELETE FROM is_in_shelf
        WHERE shelf_id = $1 AND book_id = $2
        ",
    )
    .bind(shelf_id)
    .bind(book_id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ShelfBookError::ShelfBookNotFound);
    }

    Ok(())
}

pub async fn shelf_exists<'e>(db: impl SqliteExecutor<'e>, shelf_id: &str) -> bool {
    sqlx::query_scalar(
        r"
        SELECT EXISTS(SELECT 1 FROM shelf WHERE shelf_id = ?)
        ",
    )
    .bind(shelf_id)
    .fetch_one(db)
    .await
    .unwrap_or(false)
}
