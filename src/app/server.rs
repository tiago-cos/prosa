use super::{annotations, books, covers, metadata, state, sync, users};
use crate::app::{shelves, tracing};
use crate::{app::concurrency::manager::ProsaLockManager, config::Configuration, metadata_manager};
use axum::Router;
use axum::http::StatusCode;
use axum::middleware::from_fn;
use axum::routing::get;
use log::info;
use quick_cache::sync::Cache as QuickCache;
use sqlx::SqlitePool;
use std::{collections::HashSet, sync::Arc};
use tokio::net::TcpListener;

pub type Config = Arc<Configuration>;
pub type Pool = Arc<SqlitePool>;
pub type MetadataManager = Arc<metadata_manager::MetadataManager>;
pub type LockManager = Arc<ProsaLockManager>;
pub type ImageCache = QuickCache<String, Arc<Vec<u8>>>;
pub type SourceCache = QuickCache<String, Arc<HashSet<String>>>;
pub type TagCache = QuickCache<String, Arc<HashSet<String>>>;
pub type TagLengthCache = QuickCache<String, u32>;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub pool: Pool,
    pub metadata_manager: MetadataManager,
    pub lock_manager: LockManager,
    pub cache: Cache,
}

#[derive(Clone)]
pub struct Cache {
    pub image_cache: Arc<ImageCache>,
    pub source_cache: Arc<SourceCache>,
    pub tag_cache: Arc<TagCache>,
    pub tag_length_cache: Arc<TagLengthCache>,
}

pub async fn run(config: Configuration, pool: SqlitePool) {
    let image_cache = Arc::new(QuickCache::new(50));
    let source_cache = Arc::new(QuickCache::new(100000));
    let tag_cache = Arc::new(QuickCache::new(100000));
    let tag_length_cache = Arc::new(QuickCache::new(100000));

    let cache = Cache {
        image_cache: image_cache.clone(),
        source_cache,
        tag_cache,
        tag_length_cache,
    };

    let config = Arc::new(config.clone());
    let pool = Arc::new(pool);
    let lock_manager = Arc::new(ProsaLockManager::new(20));
    let metadata_manager =
        metadata_manager::MetadataManager::new(pool.clone(), lock_manager.clone(), image_cache, &config);

    let state = AppState {
        config,
        pool,
        metadata_manager,
        lock_manager,
        cache,
    };

    let host = format!("{}:{}", &state.config.server.host, &state.config.server.port);

    tracing::init_logging();
    info!("Server started on http://{host}");

    let app = Router::new()
        .route("/health", get(|| async { StatusCode::NO_CONTENT }))
        .merge(users::routes::get_routes(state.clone()))
        .merge(metadata::routes::get_routes(state.clone()))
        .merge(covers::routes::get_routes(state.clone()))
        .merge(state::routes::get_routes(state.clone()))
        .merge(sync::routes::get_routes(state.clone()))
        .merge(books::routes::get_routes(state.clone()))
        .merge(annotations::routes::get_routes(state.clone()))
        .merge(shelves::routes::get_routes(state.clone()))
        .layer(from_fn(tracing::log_layer));

    let listener = TcpListener::bind(&host).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
