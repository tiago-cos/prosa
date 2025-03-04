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

    // Book tables
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS books (
            book_id TEXT NOT NULL PRIMARY KEY,
            owner_id TEXT NOT NULL,
            epub_id TEXT NOT NULL,
            metadata_id TEXT,
            cover_id TEXT,
            state_id TEXT NOT NULL,
            sync_id TEXT NOT NULL,
            FOREIGN KEY(epub_id) REFERENCES epubs(epub_id) ON DELETE CASCADE,
            FOREIGN KEY(metadata_id) REFERENCES metadata(metadata_id) ON DELETE SET NULL,
            FOREIGN KEY(cover_id) REFERENCES covers(cover_id) ON DELETE SET NULL,
            FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
            FOREIGN KEY(state_id) REFERENCES state(state_id) ON DELETE CASCADE,
            FOREIGN KEY(sync_id) REFERENCES sync(sync_id) ON DELETE CASCADE,
            UNIQUE(epub_id, owner_id)
        );

        CREATE TABLE IF NOT EXISTS deleted_books (
            book_id TEXT NOT NULL PRIMARY KEY,
            sync_id TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            FOREIGN KEY(sync_id) REFERENCES sync(sync_id) ON DELETE CASCADE,
            FOREIGN KEY(owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
            UNIQUE(book_id, sync_id)
        );

        CREATE TABLE IF NOT EXISTS epubs (
            epub_id TEXT PRIMARY KEY NOT NULL,
            hash TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS covers (
            cover_id TEXT PRIMARY KEY NOT NULL,
            hash TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS metadata (
            metadata_id TEXT PRIMARY KEY NOT NULL,
            title TEXT,
            subtitle TEXT,
            description TEXT,
            publisher TEXT,
            publication_date DATETIME,
            isbn TEXT,
            page_count INTEGER,
            language TEXT
        );

        CREATE TABLE IF NOT EXISTS series (
            metadata_id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            number REAL NOT NULL,
            FOREIGN KEY(metadata_id) REFERENCES metadata(metadata_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS contributors (
            metadata_id TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY(metadata_id) REFERENCES metadata(metadata_id) ON DELETE CASCADE,
            PRIMARY KEY(metadata_id, role, name)
        );

        CREATE TABLE IF NOT EXISTS genres (
            metadata_id TEXT NOT NULL,
            genre TEXT NOT NULL,
            FOREIGN KEY(metadata_id) REFERENCES metadata(metadata_id) ON DELETE CASCADE,
            PRIMARY KEY(metadata_id, genre)
        );

        CREATE TABLE IF NOT EXISTS state (
            state_id TEXT PRIMARY KEY NOT NULL,
            tag TEXT,
            source TEXT,
            rating REAL,
            reading_status TEXT NOT NULL CHECK(reading_status IN ('Unread','Reading','Read'))
        );

        CREATE TABLE IF NOT EXISTS sync (
            sync_id TEXT PRIMARY KEY NOT NULL,
            file DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            metadata DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            cover DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            state DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted DATETIME
        );
        "#,
    )
    .execute(pool)
    .await
    .expect("Failed to create book tables");
}

pub async fn clear_tables(pool: &SqlitePool) {
    sqlx::query(
        r#"
        DROP TABLE IF EXISTS key_capabilities;
        DROP TABLE IF EXISTS providers;
        DROP TABLE IF EXISTS books;
        DROP TABLE IF EXISTS deleted_books;
        DROP TABLE IF EXISTS series;
        DROP TABLE IF EXISTS contributors;
        DROP TABLE IF EXISTS genres;
        DROP TABLE IF EXISTS api_keys;
        DROP TABLE IF EXISTS epubs;
        DROP TABLE IF EXISTS covers;
        DROP TABLE IF EXISTS metadata;
        DROP TABLE IF EXISTS state;
        DROP TABLE IF EXISTS sync;
        DROP TABLE IF EXISTS users;
        "#,
    )
    .execute(pool)
    .await
    .expect("Failed to drop tables");
}
