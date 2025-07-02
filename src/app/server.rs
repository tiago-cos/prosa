use super::{annotations, books, covers, metadata, state, sync, users};
use crate::{app::concurrency::manager::BookLockManager, config::Configuration, metadata_manager};
use axum::Router;
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::net::TcpListener;

pub type Config = Arc<Configuration>;
pub type Pool = Arc<SqlitePool>;
pub type MetadataManager = Arc<metadata_manager::MetadataManager>;
pub type LockManager = Arc<BookLockManager>;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub pool: Pool,
    pub metadata_manager: MetadataManager,
    pub lock_manager: LockManager,
}

pub async fn run(config: Configuration, pool: SqlitePool) {
    let state = AppState {
        config: Arc::new(config.clone()),
        pool: Arc::new(pool),
        metadata_manager: Arc::new(metadata_manager::MetadataManager::new(&config)),
        lock_manager: Arc::new(BookLockManager::new()),
    };
    let host = format!("{}:{}", &state.config.server.host, &state.config.server.port);
    let app = Router::new()
        .merge(users::routes::get_routes(state.clone()))
        .merge(metadata::routes::get_routes(state.clone()))
        .merge(covers::routes::get_routes(state.clone()))
        .merge(state::routes::get_routes(state.clone()))
        .merge(sync::routes::get_routes(state.clone()))
        .merge(books::routes::get_routes(state.clone()))
        .merge(annotations::routes::get_routes(state.clone()));

    let listener = TcpListener::bind(host).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
