use crate::DB_POOL;
use crate::app::sync::models::{ChangeLogAction, ChangeLogEntityType, ChangeLogEntry};

pub async fn delete_log_entries(entity_id: &str) {
    sqlx::query(
        r"
        DELETE FROM change_log
        WHERE entity_id = $1
        ",
    )
    .bind(entity_id)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to delete logs");
}

pub async fn log_change(
    entity_id: &str,
    entity_type: ChangeLogEntityType,
    action: ChangeLogAction,
    owner_id: &str,
    session_id: &str,
) {
    sqlx::query(
        r"
        INSERT INTO change_log (entity_id, entity_type, owner_id, session_id, action)
        VALUES ($1, $2, $3, $4, $5)
        ",
    )
    .bind(entity_id)
    .bind(entity_type)
    .bind(owner_id)
    .bind(session_id)
    .bind(action)
    .execute(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to log change");
}

pub async fn get_changes(user_id: &str, last_sync_token: i64, session_id: &str) -> Vec<ChangeLogEntry> {
    let changes: Vec<ChangeLogEntry> = sqlx::query_as(
        r"
        SELECT log_id, entity_id, entity_type, owner_id, session_id, action
        FROM change_log
        WHERE owner_id = $1
        AND log_id > $2
        AND session_id != $3
        ORDER BY log_id ASC
        ",
    )
    .bind(user_id)
    .bind(last_sync_token)
    .bind(session_id)
    .fetch_all(DB_POOL.get().expect("Failed to get database pool"))
    .await
    .expect("Failed to fetch change log");

    changes
}
