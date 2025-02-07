use super::models::{Location, State, Statistics};
use sqlx::SqlitePool;

pub async fn get_state(pool: &SqlitePool, state_id: &str) -> State {
    let (tag, source, rating): (Option<String>, Option<String>, Option<f32>) = sqlx::query_as(
        r#"
        SELECT tag, source, rating
        FROM state
        WHERE state_id = $1
        "#,
    )
    .bind(state_id)
    .fetch_one(pool)
    .await
    .expect("Failed to get book state");

    let location = Location { tag, source };

    let statistics = Statistics { rating };

    State { location, statistics }
}

pub async fn add_state(pool: &SqlitePool, state_id: &str, state: State) -> () {
    sqlx::query(
        r#"
        INSERT INTO state (state_id, tag, source, rating) VALUES
        ($1, $2, $3, $4)
        "#,
    )
    .bind(state_id)
    .bind(state.location.tag)
    .bind(state.location.source)
    .bind(state.statistics.rating)
    .execute(pool)
    .await
    .expect("Failed to add book state");
}

pub async fn update_state(pool: &SqlitePool, state_id: &str, state: State) -> () {
    sqlx::query(
        r#"
        UPDATE state
        SET tag = $1, source = $2, rating = $3
        WHERE state_id = $4
        "#,
    )
    .bind(state_id)
    .bind(state.location.tag)
    .bind(state.location.source)
    .bind(state.statistics.rating)
    .execute(pool)
    .await
    .expect("Failed to update book state");
}
