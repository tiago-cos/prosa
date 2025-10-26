use super::{annotations, books, covers, metadata, state, sync, users};
use crate::app::books::service::BookService;
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
pub type MetadataManager = Arc<metadata_manager::MetadataManager>;
pub type LockManager = Arc<ProsaLockManager>;
pub type ImageCache = QuickCache<String, Arc<Vec<u8>>>;
pub type SourceCache = QuickCache<String, Arc<HashSet<String>>>;
pub type TagCache = QuickCache<String, Arc<HashSet<String>>>;
pub type TagLengthCache = QuickCache<String, u32>;

pub async fn run(config: Configuration, pool: SqlitePool) {
    let state = AppState::default(config, &pool);
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

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub pool: SqlitePool,
    pub metadata_manager: MetadataManager,
    pub lock_manager: LockManager,
    pub cache: Cache,
    pub books: BookDomain,
}

#[derive(Clone)]
pub struct Cache {
    pub image_cache: Arc<ImageCache>,
    pub source_cache: Arc<SourceCache>,
    pub tag_cache: Arc<TagCache>,
    pub tag_length_cache: Arc<TagLengthCache>,
}

#[derive(Clone)]
pub struct BookDomain {
    pub service: Arc<BookService>,
}

impl BookDomain {
    pub fn new(pool: &SqlitePool) -> Self {
        let service = Arc::new(BookService::new(pool.clone()));
        Self { service }
    }
}

impl AppState {
    pub fn default(config: Configuration, pool: &SqlitePool) -> Self {
        let config = Arc::new(config);
        let lock_manager = Arc::new(ProsaLockManager::new(20));

        let cache = Cache {
            image_cache: Arc::new(QuickCache::new(50)),
            source_cache: Arc::new(QuickCache::new(100000)),
            tag_cache: Arc::new(QuickCache::new(100000)),
            tag_length_cache: Arc::new(QuickCache::new(100000)),
        };

        let books = BookDomain::new(pool);

        let metadata_manager = metadata_manager::MetadataManager::new(
            pool.clone(),
            books.service.clone(),
            lock_manager.clone(),
            cache.image_cache.clone(),
            &config,
        );

        Self {
            config,
            pool: pool.clone(),
            metadata_manager,
            lock_manager,
            cache,
            books,
        }
    }
}
