use super::models::{State, Statistics};
use sqlx::SqliteExecutor;

pub async fn get_state<'e>(db: impl SqliteExecutor<'e>, book_id: &str) -> State {
    let (location, rating, reading_status): (Option<String>, Option<f32>, String) = sqlx::query_as(
        r"
        SELECT location, rating, reading_status
        FROM state
        WHERE book_id = $1
        ",
    )
    .bind(book_id)
    .fetch_one(db)
    .await
    .expect("Failed to get book state");

    let statistics = Statistics {
        rating,
        reading_status: Some(reading_status),
    };

    State {
        location,
        statistics: Some(statistics),
    }
}

pub async fn add_state<'e>(db: impl SqliteExecutor<'e>, book_id: &str, state: State) {
    let statistics = state.statistics.expect("Statistics should be present");
    let reading_status = statistics
        .reading_status
        .expect("Reading status should be present");

    sqlx::query(
        r"
        INSERT INTO state (book_id, location, rating, reading_status)
        VALUES ($1, $2, $3, $4)
        ",
    )
    .bind(book_id)
    .bind(state.location)
    .bind(statistics.rating)
    .bind(reading_status)
    .execute(db)
    .await
    .expect("Failed to add book state");
}

pub async fn update_state<'e>(db: impl SqliteExecutor<'e>, book_id: &str, state: State) {
    let statistics = state.statistics.expect("Statistics should be present");
    let reading_status = statistics
        .reading_status
        .expect("Reading status should be present");

    sqlx::query(
        r"
        UPDATE state
        SET location = $1, rating = $2, reading_status = $3
        WHERE book_id = $4
        ",
    )
    .bind(state.location)
    .bind(statistics.rating)
    .bind(reading_status)
    .bind(book_id)
    .execute(db)
    .await
    .expect("Failed to update book state");
}
