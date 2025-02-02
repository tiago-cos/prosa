use sqlx::SqlitePool;

pub async fn create_tables(pool: &SqlitePool) {
    // User tables
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS providers (
            provider_type TEXT NOT NULL CHECK(provider_type IN ('goodreads_metadata_scraper','epub_metadata_extractor')),
            priority INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
            PRIMARY KEY (provider_type, user_id)
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            key_id TEXT PRIMARY KEY NOT NULL,
            user_id TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            expiration DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS key_capabilities (
            key_id TEXT NOT NULL,
            capability TEXT NOT NULL CHECK(capability IN ('Create','Read','Update','Delete')),
            FOREIGN KEY(key_id) REFERENCES api_keys(key_id) ON DELETE CASCADE,
            PRIMARY KEY(key_id, capability)
        );
        "#,
    )
    .execute(pool)
    .await
    .expect("Failed to create user tables");
}

pub async fn clear_tables(pool: &SqlitePool) {
    // User tables
    sqlx::query(
        r#"
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS preferences;
        DROP TABLE IF EXISTS api_keys;
        DROP TABLE IF EXISTS key_capabilities;
        "#,
    )
    .execute(pool)
    .await
    .expect("Failed to drop user tables");
}
