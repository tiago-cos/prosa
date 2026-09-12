use super::models::{ApiKey, Preferences, PreferencesError, User, UserError};
use crate::app::{
    authentication::models::ApiKeyError,
    users::models::{DEFAULT_PROVIDER, PROVIDERS, UserProfile},
};
use sqlx::{Acquire, QueryBuilder, Sqlite, SqliteExecutor};

pub async fn add_user<'e>(
    db: impl SqliteExecutor<'e>,
    username: &str,
    user_id: &str,
    password_hash: &str,
    is_admin: bool,
) -> Result<(), UserError> {
    sqlx::query(
        r"
        INSERT INTO users (user_id, username, password_hash, is_admin, automatic_metadata)
        VALUES ($1, $2, $3, $4, $5)
        ",
    )
    .bind(user_id)
    .bind(username)
    .bind(password_hash)
    .bind(is_admin)
    .bind(true)
    .execute(db)
    .await?;

    Ok(())
}

pub async fn get_user<'e>(db: impl SqliteExecutor<'e>, user_id: &str) -> Result<User, UserError> {
    let user = sqlx::query_as(
        r"
        SELECT user_id, username, password_hash, is_admin
        FROM users
        WHERE user_id = $1
        ",
    )
    .bind(user_id)
    .fetch_one(db)
    .await?;

    Ok(user)
}

pub async fn update_user_profile<'e>(
    db: impl SqliteExecutor<'e>,
    user_id: &str,
    profile: UserProfile,
) -> Result<(), UserError> {
    let result = sqlx::query(
        r"
        UPDATE users
        SET username = $1
        WHERE user_id = $2
        ",
    )
    .bind(profile.username)
    .bind(user_id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(UserError::UserNotFound);
    }

    Ok(())
}

pub async fn get_user_by_username<'e>(
    db: impl SqliteExecutor<'e>,
    username: &str,
) -> Result<User, UserError> {
    let user = sqlx::query_as(
        r"
        SELECT user_id, username, password_hash, is_admin
        FROM users
        WHERE username = $1
        ",
    )
    .bind(username)
    .fetch_one(db)
    .await?;

    Ok(user)
}

pub async fn get_api_key_information<'a>(
    db: impl Acquire<'a, Database = Sqlite>,
    user_id: &str,
    key_id: &str,
) -> Result<ApiKey, ApiKeyError> {
    let mut conn = db.acquire().await?;

    let mut key: ApiKey = sqlx::query_as(
        r"
        SELECT 
            key_id,
            user_id,
            name,
            expiration
        FROM api_keys
        WHERE key_id = $1 AND user_id = $2
        ",
    )
    .bind(key_id)
    .bind(user_id)
    .fetch_one(&mut *conn)
    .await?;

    let capabilities: Vec<String> = sqlx::query_scalar(
        r"
        SELECT capability
        FROM key_capabilities
        WHERE key_id = $1
        ",
    )
    .bind(key_id)
    .fetch_all(&mut *conn)
    .await?;

    key.capabilities = capabilities;

    Ok(key)
}

pub async fn list_api_keys<'e>(
    db: impl SqliteExecutor<'e>,
    user_id: &str,
) -> Result<Vec<String>, ApiKeyError> {
    let keys: Vec<String> = sqlx::query_scalar(
        r"
        SELECT key_id
        FROM api_keys
        WHERE user_id = $1
        ",
    )
    .bind(user_id)
    .fetch_all(db)
    .await?;

    Ok(keys)
}

pub async fn add_providers<'e>(db: impl SqliteExecutor<'e>, user_id: &str) {
    let mut query =
        QueryBuilder::new("INSERT INTO user_providers (user_id, provider_id, enabled, priority, api_key)");

    query.push_values(PROVIDERS.iter().enumerate(), |mut b, (index, (provider, _))| {
        b.push_bind(user_id)
            .push_bind(*provider)
            .push_bind(*provider == DEFAULT_PROVIDER)
            .push_bind(i64::try_from(index).unwrap_or_default())
            .push_bind(None::<String>);
    });

    query
        .build()
        .execute(db)
        .await
        .expect("Failed to add initial providers");
}

pub async fn get_configured_providers<'e>(
    db: impl SqliteExecutor<'e>,
    user_id: &str,
) -> Result<Vec<String>, PreferencesError> {
    let providers = sqlx::query_scalar(
        r"
        SELECT provider_id
        FROM user_providers
        WHERE user_id = $1 AND api_key IS NOT NULL
        ORDER BY priority
        ",
    )
    .bind(user_id)
    .fetch_all(db)
    .await?;

    Ok(providers)
}

pub async fn get_provider_keys<'e>(
    db: impl SqliteExecutor<'e>,
    user_id: &str,
) -> Result<Vec<(String, Option<String>)>, PreferencesError> {
    let providers = sqlx::query_as(
        r"
        SELECT provider_id, api_key
        FROM user_providers
        WHERE user_id = $1
        ORDER BY priority
        ",
    )
    .bind(user_id)
    .fetch_all(db)
    .await?;

    Ok(providers)
}

pub async fn get_preferences<'a>(
    db: impl Acquire<'a, Database = Sqlite>,
    user_id: &str,
) -> Result<Preferences, PreferencesError> {
    let mut conn = db.acquire().await?;

    let providers: Vec<String> = sqlx::query_scalar(
        r"
        SELECT provider_id
        FROM user_providers
        WHERE user_id = $1 AND enabled = TRUE
        ORDER BY priority
        ",
    )
    .bind(user_id)
    .fetch_all(&mut *conn)
    .await?;

    let configured = get_configured_providers(&mut *conn, user_id).await?;

    let automatic_metadata: bool = sqlx::query_scalar(
        r"
        SELECT automatic_metadata
        FROM users
        WHERE user_id = $1
        ",
    )
    .bind(user_id)
    .fetch_one(&mut *conn)
    .await?;

    Ok(Preferences {
        metadata_providers: Some(providers),
        provider_keys: None,
        configured_providers: Some(configured),
        automatic_metadata: Some(automatic_metadata),
    })
}

pub async fn update_preferences<'a>(
    db: impl Acquire<'a, Database = Sqlite>,
    user_id: &str,
    preferences: Preferences,
    keys: Vec<(String, Option<String>)>,
) -> Result<(), PreferencesError> {
    let automatic_metadata = preferences
        .automatic_metadata
        .expect("Metadata preference should be present");
    let providers = preferences
        .metadata_providers
        .expect("Providers should be present");

    let mut tx = db.begin().await?;

    sqlx::query(
        r"
        UPDATE users
        SET automatic_metadata = $1
        WHERE user_id = $2
        ",
    )
    .bind(automatic_metadata)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r"
        INSERT OR IGNORE INTO user_providers (user_id, provider_id, enabled, priority)
        SELECT $1, provider_id, FALSE, 0
        FROM providers
        ",
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r"
        UPDATE user_providers
        SET enabled = FALSE
        WHERE user_id = $1
        ",
    )
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    for (priority, provider) in providers.iter().enumerate() {
        sqlx::query(
            r"
            UPDATE user_providers
            SET enabled = TRUE, priority = $1
            WHERE user_id = $2 AND provider_id = $3
            ",
        )
        .bind(i64::try_from(priority).unwrap_or_default())
        .bind(user_id)
        .bind(provider)
        .execute(&mut *tx)
        .await?;
    }

    for (provider, key) in keys {
        sqlx::query(
            r"
            UPDATE user_providers
            SET api_key = $1
            WHERE user_id = $2 AND provider_id = $3
            ",
        )
        .bind(key)
        .bind(user_id)
        .bind(&provider)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(())
}

pub async fn user_exists<'e>(db: impl SqliteExecutor<'e>, user_id: &str) -> bool {
    sqlx::query_scalar(
        r"
        SELECT EXISTS(SELECT 1 FROM users WHERE user_id = ?)
        ",
    )
    .bind(user_id)
    .fetch_one(db)
    .await
    .unwrap_or(false)
}
