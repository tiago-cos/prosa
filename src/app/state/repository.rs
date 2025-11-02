use super::models::{Location, State, Statistics};
use sqlx::SqlitePool;

pub struct StateRepository {
    pool: SqlitePool,
}

impl StateRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get_state(&self, state_id: &str) -> State {
        let (tag, source, rating, reading_status): (Option<String>, Option<String>, Option<f32>, String) =
            sqlx::query_as(
                r"
                SELECT tag, source, rating, reading_status
                FROM state
                WHERE state_id = $1
                ",
            )
            .bind(state_id)
            .fetch_one(&self.pool)
            .await
            .expect("Failed to get book state");

        let location = (tag.is_some() && source.is_some()).then_some(Location { tag, source });
        let statistics = Statistics {
            rating,
            reading_status: Some(reading_status),
        };

        State {
            location,
            statistics: Some(statistics),
        }
    }

    pub async fn add_state(&self, state_id: &str, state: State) {
        let (tag, source) = state.location.map_or((None, None), |l| (l.tag, l.source));
        let statistics = state.statistics.expect("Statistics should be present");
        let reading_status = statistics
            .reading_status
            .expect("Reading status should be present");

        sqlx::query(
            r"
            INSERT INTO state (state_id, tag, source, rating, reading_status)
            VALUES ($1, $2, $3, $4, $5)
            ",
        )
        .bind(state_id)
        .bind(tag)
        .bind(source)
        .bind(statistics.rating)
        .bind(reading_status.clone())
        .execute(&self.pool)
        .await
        .expect("Failed to add book state");
    }

    pub async fn update_state(&self, state_id: &str, state: State) {
        let (tag, source) = state.location.map_or((None, None), |l| (l.tag, l.source));
        let statistics = state.statistics.expect("Statistics should be present");
        let reading_status = statistics
            .reading_status
            .expect("Reading status should be present");

        sqlx::query(
            r"
            UPDATE state
            SET tag = $1, source = $2, rating = $3, reading_status = $4
            WHERE state_id = $5
            ",
        )
        .bind(tag)
        .bind(source)
        .bind(statistics.rating)
        .bind(reading_status)
        .bind(state_id)
        .execute(&self.pool)
        .await
        .expect("Failed to update book state");
    }
}
