use sqlx::{Pool, Sqlite, SqlitePool, sqlite::SqliteConnectOptions};

pub type DatabaseError = Box<dyn std::error::Error + Send + Sync>;

fn connect_options(filename: &str) -> SqliteConnectOptions {
    SqliteConnectOptions::new()
        .filename(filename)
        .create_if_missing(true)
}

pub async fn connect(filename: &str) -> Result<Pool<Sqlite>, DatabaseError> {
    let pool = SqlitePool::connect_with(connect_options(filename)).await?;

    Ok(pool)
}

pub async fn init(filename: &str) -> Result<Pool<Sqlite>, DatabaseError> {
    let pool = connect(filename).await?;
    super::migrations::apply(&pool, filename).await?;

    Ok(pool)
}
