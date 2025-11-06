use super::tables::{clear_tables, create_tables};
use sqlx::{Pool, Sqlite, SqlitePool, sqlite::SqliteConnectOptions};

#[allow(dead_code)]
pub async fn init(filename: &str) -> Pool<Sqlite> {
    let db_options = SqliteConnectOptions::new()
        .filename(filename)
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(db_options).await.unwrap();

    create_tables(&pool).await;

    pool
}

#[allow(dead_code)]
pub async fn debug_init(filename: &str) -> Pool<Sqlite> {
    let db_options = SqliteConnectOptions::new()
        .filename(filename)
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(db_options).await.unwrap();

    clear_tables(&pool).await;
    create_tables(&pool).await;

    pool
}
