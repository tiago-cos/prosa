use super::{annotations, books, covers, metadata, state, sync, users};
use crate::{app::concurrency::manager::BookLockManager, config::Configuration, metadata_manager};
use axum::Router;
use quick_cache::sync::Cache;
use sqlx::SqlitePool;
use std::{collections::HashSet, sync::Arc};
use tokio::net::TcpListener;

pub type Config = Arc<Configuration>;
pub type Pool = Arc<SqlitePool>;
pub type MetadataManager = Arc<metadata_manager::MetadataManager>;
pub type LockManager = Arc<BookLockManager>;
pub type ImageCache = Cache<String, Arc<Vec<u8>>>;
pub type SourceCache = Cache<String, Arc<HashSet<String>>>;
pub type TagCache = Cache<String, Arc<HashSet<String>>>;
pub type TagLengthCache = Cache<String, u32>;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub pool: Pool,
    pub metadata_manager: MetadataManager,
    pub lock_manager: LockManager,
    pub cache: AppCache,
}

#[derive(Clone)]
pub struct AppCache {
    pub image_cache: Arc<ImageCache>,
    pub source_cache: Arc<SourceCache>,
    pub tag_cache: Arc<TagCache>,
    pub tag_length_cache: Arc<TagLengthCache>,
}

pub async fn run(config: Configuration, pool: SqlitePool) {
    let image_cache = Arc::new(Cache::new(50));
    let source_cache = Arc::new(Cache::new(100000));
    let tag_cache = Arc::new(Cache::new(100000));
    let tag_length_cache = Arc::new(Cache::new(100000));

    let cache = AppCache {
        image_cache,
        source_cache,
        tag_cache,
        tag_length_cache,
    };

    let state = AppState {
        config: Arc::new(config.clone()),
        pool: Arc::new(pool),
        metadata_manager: Arc::new(metadata_manager::MetadataManager::new(&config)),
        lock_manager: Arc::new(BookLockManager::new()),
        cache,
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
