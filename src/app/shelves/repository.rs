use super::models::{Shelf, ShelfError};
use crate::DB_POOL;
use crate::app::shelves::models::{PaginatedShelves, ShelfBookError};

pub async fn get_shelf(shelf_id: &str) -> Result<Shelf, ShelfError> {
    let shelf: Shelf = sqlx::query_as(
        r"
        SELECT name, owner_id
        FROM shelf
        WHERE shelf_id = $1
        ",
    )
    .bind(shelf_id)
    .fetch_one(DB_POOL.get().expect("Failed to get database pool"))
    .await?;

    Ok(shelf)
}

pub async fn get_shelf_by_name_and_owner(name: &str, owner_id: &str) -> Option<Shelf> {
    sqlx::query_as(
        r"
        SELECT name, owner_id
        FROM shelf
        WHERE name = $1 AND owner_id = $2
        ",
    )
    .bind(name)
    .bind(owner_id)
    .fetch_optional(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to fetch shelf by name and owner")
}

pub async fn add_shelf(shelf_id: &str, shelf: Shelf) -> Result<(), ShelfError> {
    sqlx::query(
        r"
        INSERT INTO shelf (shelf_id, name, owner_id)
        VALUES ($1, $2, $3);
        ",
    )
    .bind(shelf_id)
    .bind(shelf.name)
    .bind(shelf.owner_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await?;

    Ok(())
}

pub async fn delete_shelf(shelf_id: &str) -> Result<(), ShelfError> {
    let result = sqlx::query(
        r"
        DELETE FROM shelf
        WHERE shelf_id = $1;
        ",
    )
    .bind(shelf_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await?;

    if result.rows_affected() == 0 {
        return Err(ShelfError::ShelfNotFound);
    }

    Ok(())
}

pub async fn update_shelf(shelf_id: &str, name: &str) -> Result<(), ShelfError> {
    let result = sqlx::query(
        r"
        UPDATE shelf
        SET name = $1
        WHERE shelf_id = $2;
        ",
    )
    .bind(name)
    .bind(shelf_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await?;

    if result.rows_affected() == 0 {
        return Err(ShelfError::ShelfNotFound);
    }

    Ok(())
}

pub async fn get_paginated_shelves(
    page: i64,
    page_size: i64,
    username: Option<String>,
    name: Option<String>,
) -> PaginatedShelves {
    let offset = (page - 1) * page_size;
    let mut bind_params: Vec<String> = Vec::new();

    let mut shelf_query = String::from(
        r"
        SELECT DISTINCT shelf_id
        FROM shelf s
        INNER JOIN users u ON s.owner_id = u.user_id
        WHERE 1=1
        ",
    );

    let mut count_query = String::from(
        r"
        SELECT COUNT(DISTINCT shelf_id)
        FROM shelf s
        INNER JOIN users u ON s.owner_id = u.user_id
        WHERE 1=1
        ",
    );

    if let Some(username) = username {
        let part = format!(" AND u.username = ${}", bind_params.len() + 1);
        shelf_query.push_str(&part);
        count_query.push_str(&part);
        bind_params.push(username);
    }

    if let Some(name) = name {
        let part = format!(
            " AND s.name LIKE '%' || ${} || '%' COLLATE NOCASE",
            bind_params.len() + 1
        );
        shelf_query.push_str(&part);
        count_query.push_str(&part);
        bind_params.push(name);
    }

    let part = format!(
        " ORDER BY s.shelf_id LIMIT ${} OFFSET ${}",
        bind_params.len() + 1,
        bind_params.len() + 2
    );
    shelf_query.push_str(&part);

    let mut shelf_ids = sqlx::query_scalar(&shelf_query);
    let mut total_elements = sqlx::query_scalar(&count_query);

    for param in bind_params {
        shelf_ids = shelf_ids.bind(param.clone());
        total_elements = total_elements.bind(param);
    }

    shelf_ids = shelf_ids.bind(page_size).bind(offset);

    let shelf_ids = shelf_ids
        .fetch_all(DB_POOL.get().expect("Failed to get database pool"))
        .await
        .expect("Failed to search for shelves");

    let total_elements = total_elements
        .fetch_one(DB_POOL.get().expect("Failed to get database pool"))
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

pub async fn get_shelf_book_count(shelf_id: &str) -> i64 {
    let count: (i64,) = sqlx::query_as(
        r"
        SELECT COUNT(book_id)
        FROM is_in_shelf
        WHERE shelf_id = $1
        ",
    )
    .bind(shelf_id)
    .fetch_one(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to count books in shelf");

    count.0
}

pub async fn add_book_to_shelf(shelf_id: &str, book_id: &str) -> Result<(), ShelfBookError> {
    sqlx::query(
        r"
        INSERT INTO is_in_shelf (shelf_id, book_id)
        VALUES ($1, $2);
        ",
    )
    .bind(shelf_id)
    .bind(book_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await?;

    Ok(())
}

pub async fn get_shelf_books(shelf_id: &str) -> Vec<String> {
    sqlx::query_scalar(
        r"
        SELECT book_id
        FROM is_in_shelf
        WHERE shelf_id = $1
        ",
    )
    .bind(shelf_id)
    .fetch_all(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to list shelf books")
}

pub async fn delete_book_from_shelf(shelf_id: &str, book_id: &str) -> Result<(), ShelfBookError> {
    let result = sqlx::query(
        r"
        DELETE FROM is_in_shelf
        WHERE shelf_id = $1 AND book_id = $2
        ",
    )
    .bind(shelf_id)
    .bind(book_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await?;

    if result.rows_affected() == 0 {
        return Err(ShelfBookError::ShelfBookNotFound);
    }

    Ok(())
}
