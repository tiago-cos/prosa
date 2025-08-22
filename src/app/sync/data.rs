use crate::app::sync::models::{ShelfSync, UnsyncedShelves};

use super::models::{BookSync, UnsyncedBooks};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

pub async fn add_book_sync_timestamps(pool: &SqlitePool, sync_id: &str, sync: BookSync) -> () {
    sqlx::query(
        r"
        INSERT INTO book_sync (book_sync_id, file, metadata, cover, state, annotations, deleted)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
        ",
    )
    .bind(sync_id)
    .bind(sync.file)
    .bind(sync.metadata)
    .bind(sync.cover)
    .bind(sync.state)
    .bind(sync.annotations)
    .bind(sync.deleted)
    .execute(pool)
    .await
    .expect("Failed to add book sync data");
}

pub async fn get_book_sync_timestamps(pool: &SqlitePool, sync_id: &str) -> BookSync {
    let sync: BookSync = sqlx::query_as(
        r"
        SELECT file, metadata, cover, state, annotations, deleted
        FROM book_sync
        WHERE book_sync_id = $1
        ",
    )
    .bind(sync_id)
    .fetch_one(pool)
    .await
    .expect("Failed to get book sync data");

    sync
}

pub async fn update_book_sync_timestamps(pool: &SqlitePool, sync_id: &str, sync: BookSync) -> () {
    sqlx::query(
        r"
        UPDATE book_sync
        SET file = $1, metadata = $2, cover = $3, state = $4, annotations = $5, deleted = $6
        WHERE book_sync_id = $7
        ",
    )
    .bind(sync.file)
    .bind(sync.metadata)
    .bind(sync.cover)
    .bind(sync.state)
    .bind(sync.annotations)
    .bind(sync.deleted)
    .bind(sync_id)
    .execute(pool)
    .await
    .expect("Failed to update book sync data");
}

pub async fn get_unsynced_books(pool: &SqlitePool, owner_id: &str, since: DateTime<Utc>) -> UnsyncedBooks {
    let file: Vec<String> = sqlx::query_scalar(
        r"
        SELECT books.book_id
        FROM books
        JOIN book_sync ON books.book_sync_id = book_sync.book_sync_id
        WHERE books.owner_id = $1
        AND book_sync.file > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get books with unsynced files");

    let metadata: Vec<String> = sqlx::query_scalar(
        r"
        SELECT books.book_id
        FROM books
        JOIN book_sync ON books.book_sync_id = book_sync.book_sync_id
        WHERE books.owner_id = $1
        AND book_sync.metadata > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get books with unsynced metadata");

    let cover: Vec<String> = sqlx::query_scalar(
        r"
        SELECT books.book_id
        FROM books
        JOIN book_sync ON books.book_sync_id = book_sync.book_sync_id
        WHERE books.owner_id = $1
        AND book_sync.cover > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get books with unsynced covers");

    let state: Vec<String> = sqlx::query_scalar(
        r"
        SELECT books.book_id
        FROM books
        JOIN book_sync ON books.book_sync_id = book_sync.book_sync_id
        WHERE books.owner_id = $1
        AND book_sync.state > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get books with unsynced state");

    let annotations: Vec<String> = sqlx::query_scalar(
        r"
        SELECT books.book_id
        FROM books
        JOIN book_sync ON books.book_sync_id = book_sync.book_sync_id
        WHERE books.owner_id = $1
        AND book_sync.annotations > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get books with unsynced state");

    let deleted: Vec<String> = sqlx::query_scalar(
        r"
        SELECT deleted_books.book_id
        FROM deleted_books
        JOIN book_sync ON deleted_books.book_sync_id = book_sync.book_sync_id
        WHERE deleted_books.owner_id = $1
        AND book_sync.deleted > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get unsynced deleted books");

    UnsyncedBooks {
        file,
        metadata,
        cover,
        state,
        annotations,
        deleted,
    }
}

//TODO update prosa sync structs in kobont

pub async fn add_shelf_sync_timestamps(pool: &SqlitePool, sync_id: &str, sync: ShelfSync) -> () {
    sqlx::query(
        r"
        INSERT INTO shelf_sync (shelf_sync_id, contents, metadata, deleted)
        VALUES ($1, $2, $3, $4);
        ",
    )
    .bind(sync_id)
    .bind(sync.contents)
    .bind(sync.metadata)
    .bind(sync.deleted)
    .execute(pool)
    .await
    .expect("Failed to add shelf sync data");
}

pub async fn get_shelf_sync_timestamps(pool: &SqlitePool, sync_id: &str) -> ShelfSync {
    let sync: ShelfSync = sqlx::query_as(
        r"
        SELECT contents, metadata, deleted
        FROM shelf_sync
        WHERE shelf_sync_id = $1
        ",
    )
    .bind(sync_id)
    .fetch_one(pool)
    .await
    .expect("Failed to get shelf sync data");

    sync
}

pub async fn update_shelf_sync_timestamps(pool: &SqlitePool, sync_id: &str, sync: ShelfSync) -> () {
    sqlx::query(
        r"
        UPDATE shelf_sync
        SET contents = $1, metadata = $2, deleted = $3
        WHERE shelf_sync_id = $4
        ",
    )
    .bind(sync.contents)
    .bind(sync.metadata)
    .bind(sync.deleted)
    .bind(sync_id)
    .execute(pool)
    .await
    .expect("Failed to update shelf sync data");
}

pub async fn get_unsynced_shelves(
    pool: &SqlitePool,
    owner_id: &str,
    since: DateTime<Utc>,
) -> UnsyncedShelves {
    let contents: Vec<String> = sqlx::query_scalar(
        r"
        SELECT shelf.shelf_id
        FROM shelf
        JOIN shelf_sync ON shelf.shelf_sync_id = shelf_sync.shelf_sync_id
        WHERE shelf.owner_id = $1
        AND shelf_sync.contents > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get shelves with unsynced contents");

    let metadata: Vec<String> = sqlx::query_scalar(
        r"
        SELECT shelf.shelf_id
        FROM shelf
        JOIN shelf_sync ON shelf.shelf_sync_id = shelf_sync.shelf_sync_id
        WHERE shelf.owner_id = $1
        AND  shelf_sync.metadata > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get shelves with unsynced metadata");

    let deleted: Vec<String> = sqlx::query_scalar(
        r"
        SELECT deleted_shelves.shelf_id
        FROM deleted_shelves
        JOIN shelf_sync ON deleted_shelves.shelf_sync_id = shelf_sync.shelf_sync_id
        WHERE deleted_shelves.owner_id = $1
        AND  shelf_sync.deleted > $2
        ",
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get unsynced deleted shelves");

    UnsyncedShelves {
        contents,
        metadata,
        deleted,
    }
}
