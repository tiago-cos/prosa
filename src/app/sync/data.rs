use super::models::{Sync, Unsynced};
use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

pub async fn add_sync_timestamps(pool: &SqlitePool, sync_id: &str, sync: Sync) -> () {
    sqlx::query(
        r#"
        INSERT INTO sync (sync_id, file, metadata, cover, deleted)
        VALUES ($1, $2, $3, $4, $5);
        "#,
    )
    .bind(sync_id)
    .bind(sync.file)
    .bind(sync.metadata)
    .bind(sync.cover)
    .bind(sync.deleted)
    .execute(pool)
    .await
    .expect("Failed to add sync data");
}

pub async fn get_sync_timestamps(pool: &SqlitePool, sync_id: &str) -> Sync {
    let sync: Sync = sqlx::query_as(
        r#"
        SELECT file, metadata, cover, deleted
        FROM sync
        WHERE sync_id = $1
        "#,
    )
    .bind(sync_id)
    .fetch_one(pool)
    .await
    .expect("Failed to get sync data");

    sync
}

pub async fn update_sync_timestamps(pool: &SqlitePool, sync_id: &str, sync: Sync) -> () {
    sqlx::query(
        r#"
        UPDATE sync
        SET file = $1, metadata = $2, cover = $3, deleted = $4
        WHERE sync_id = $5
        "#,
    )
    .bind(sync.file)
    .bind(sync.metadata)
    .bind(sync.cover)
    .bind(sync.deleted)
    .bind(sync_id)
    .execute(pool)
    .await
    .expect("Failed to update sync data");
}

pub async fn get_unsynced(pool: &SqlitePool, owner_id: &str, since: DateTime<Utc>) -> Unsynced {
    let file: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT books.book_id
        FROM books
        JOIN sync ON books.sync_id = sync.sync_id
        WHERE books.owner_id = $1
        AND sync.file > $2
        "#,
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get books with unsynced files");

    let metadata: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT books.book_id
        FROM books
        JOIN sync ON books.sync_id = sync.sync_id
        WHERE books.owner_id = $1
        AND sync.metadata > $2
        "#,
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get books with unsynced metadata");

    let cover: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT books.book_id
        FROM books
        JOIN sync ON books.sync_id = sync.sync_id
        WHERE books.owner_id = $1
        AND sync.cover > $2
        "#,
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get books with unsynced covers");

    let deleted: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT deleted_books.book_id
        FROM deleted_books
        JOIN sync ON deleted_books.sync_id = sync.sync_id
        WHERE deleted_books.owner_id = $1
        AND sync.deleted > $2
        "#,
    )
    .bind(owner_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .expect("Failed to get unsynced deleted books");

    Unsynced {
        file,
        metadata,
        cover,
        deleted,
    }
}
