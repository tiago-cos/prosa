use super::{annotations, books, covers, metadata, state, sync, users};
use crate::CONFIG;
use crate::app::core::locking::service::LockService;
use crate::app::core::metadata_fetcher::MetadataFetcherService;
use crate::app::{authentication, shelves, tracing};
use axum::Router;
use axum::http::StatusCode;
use axum::middleware::from_fn;
use axum::routing::get;
use log::info;
use quick_cache::sync::Cache as QuickCache;
use std::sync::LazyLock;
use std::{collections::HashSet, sync::Arc};
use tokio::net::TcpListener;

pub struct Cache {
    pub image_cache: QuickCache<String, Arc<Vec<u8>>>,
    pub source_cache: QuickCache<String, Arc<HashSet<String>>>,
    pub tag_cache: QuickCache<String, Arc<HashSet<String>>>,
    pub tag_length_cache: QuickCache<String, u32>,
}

pub static CACHE: LazyLock<Cache> = LazyLock::new(|| Cache {
    image_cache: QuickCache::new(50),
    source_cache: QuickCache::new(100000),
    tag_cache: QuickCache::new(100000),
    tag_length_cache: QuickCache::new(100000),
});

pub static METADATA_FETCHER: LazyLock<Arc<MetadataFetcherService>> = LazyLock::new(|| {
    MetadataFetcherService::new(
        CONFIG.metadata_cooldown.epub_extractor,
        CONFIG.metadata_cooldown.goodreads,
    )
});

pub static LOCKS: LazyLock<LockService> = LazyLock::new(|| LockService::new(20));

pub async fn run() {
    let host = format!("{}:{}", &CONFIG.server.host, &CONFIG.server.port);

    tracing::init_logging();
    info!("Server started on http://{host}");

    let app = Router::new()
        .route("/health", get(|| async { StatusCode::NO_CONTENT }))
        .merge(users::routes::get_routes())
        .merge(metadata::routes::get_routes())
        .merge(covers::routes::get_routes())
        .merge(state::routes::get_routes())
        .merge(sync::routes::get_routes())
        .merge(books::routes::get_routes())
        .merge(annotations::routes::get_routes())
        .merge(shelves::routes::get_routes())
        .merge(authentication::routes::get_routes())
        .layer(from_fn(tracing::log_layer));

    let listener = TcpListener::bind(&host).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
