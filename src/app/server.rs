use super::{annotations, books, covers, metadata, state, sync, users};
use crate::CONFIG;
use crate::app::core::controller;
use crate::app::core::locking::service::LockService;
use crate::app::core::metadata_fetcher::MetadataFetcherService;
use crate::app::{authentication, shelves, tracing};
use axum::Router;
use axum::middleware::from_fn;
use axum::routing::get;
use log::info;
use quick_cache::sync::Cache as QuickCache;
use std::sync::Arc;
use std::sync::LazyLock;
use tokio::net::TcpListener;

pub struct Cache {
    pub image_cache: QuickCache<String, Arc<Vec<u8>>>,
}

pub static CACHE: LazyLock<Cache> = LazyLock::new(|| Cache {
    image_cache: QuickCache::new(50),
});

pub static METADATA_FETCHER: LazyLock<Arc<MetadataFetcherService>> =
    LazyLock::new(MetadataFetcherService::new);

pub static LOCKS: LazyLock<LockService> = LazyLock::new(|| LockService::new(20));

pub async fn run() {
    let host = format!("{}:{}", CONFIG.server.host, CONFIG.server.port);

    info!("Server started on http://{host}");

    let app = Router::new()
        .route("/health", get(controller::health_check))
        .route("/config", get(controller::get_public_config))
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
