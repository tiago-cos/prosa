use super::{annotations, books, covers, metadata, state, sync, users};
use crate::app::annotations::controller::AnnotationController;
use crate::app::annotations::repository::AnnotationRepository;
use crate::app::annotations::service::AnnotationService;
use crate::app::authentication::repository::AuthenticationRepository;
use crate::app::authentication::service::AuthenticationService;
use crate::app::books::controller::BookController;
use crate::app::books::repository::BookRepository;
use crate::app::books::service::BookService;
use crate::app::covers::controller::CoverController;
use crate::app::covers::repository::CoverRepository;
use crate::app::covers::service::CoverService;
use crate::app::epubs::repository::EpubRepository;
use crate::app::epubs::service::EpubService;
use crate::app::metadata::controller::MetadataController;
use crate::app::metadata::repository::MetadataRepository;
use crate::app::metadata::service::MetadataService;
use crate::app::shelves::controller::ShelfController;
use crate::app::shelves::service::ShelfService;
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
    let state = AppState::default(config, &pool).await;
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
    pub services: Services,
    pub controllers: Controllers,
}

#[derive(Clone)]
pub struct Cache {
    pub image_cache: Arc<ImageCache>,
    pub source_cache: Arc<SourceCache>,
    pub tag_cache: Arc<TagCache>,
    pub tag_length_cache: Arc<TagLengthCache>,
}

#[derive(Clone)]
pub struct Controllers {
    pub book: Arc<BookController>,
    pub cover: Arc<CoverController>,
    pub annotation: Arc<AnnotationController>,
    pub metadata: Arc<MetadataController>,
    pub shelf: Arc<ShelfController>,
}

#[derive(Clone)]
pub struct Services {
    pub book: Arc<BookService>,
    pub shelf: Arc<ShelfService>,
    pub authentication: Arc<AuthenticationService>,
}

impl AppState {
    pub async fn default(config: Configuration, pool: &SqlitePool) -> Self {
        let config = Arc::new(config);
        let lock_manager = Arc::new(ProsaLockManager::new(20));

        let cache = Cache {
            image_cache: Arc::new(QuickCache::new(50)),
            source_cache: Arc::new(QuickCache::new(100000)),
            tag_cache: Arc::new(QuickCache::new(100000)),
            tag_length_cache: Arc::new(QuickCache::new(100000)),
        };

        let epub_repository = Arc::new(EpubRepository::new(pool.clone()));
        let epub_service = Arc::new(EpubService::new(
            epub_repository,
            lock_manager.clone(),
            config.kepubify.path.clone(),
            config.book_storage.epub_path.clone(),
        ));
        let book_repository = Arc::new(BookRepository::new(pool.clone()));
        let book_service = Arc::new(BookService::new(book_repository.clone()));
        let cover_repository = Arc::new(CoverRepository::new(pool.clone()));
        let cover_service = Arc::new(CoverService::new(
            lock_manager.clone(),
            cache.image_cache.clone(),
            config.book_storage.cover_path.clone(),
            cover_repository,
        ));
        let cover_controller = Arc::new(CoverController::new(
            pool.clone(),
            lock_manager.clone(),
            book_service.clone(),
            cover_service.clone(),
        ));
        let annotation_repository = Arc::new(AnnotationRepository::new(pool.clone()));
        let annotation_service = Arc::new(AnnotationService::new(
            config.book_storage.epub_path.clone(),
            cache.source_cache.clone(),
            cache.tag_cache.clone(),
            cache.tag_length_cache.clone(),
            book_repository.clone(),
            annotation_repository.clone(),
        ));
        let annotation_controller = Arc::new(AnnotationController::new(
            pool.clone(),
            lock_manager.clone(),
            book_service.clone(),
            annotation_service.clone(),
        ));

        let metadata_repository = Arc::new(MetadataRepository::new(pool.clone()));
        let metadata_service = Arc::new(MetadataService::new(metadata_repository.clone()));

        let metadata_manager = metadata_manager::MetadataManager::new(
            pool.clone(),
            book_service.clone(),
            lock_manager.clone(),
            &config,
            epub_service.clone(),
            cover_service.clone(),
            metadata_service.clone(),
        );

        let book_controller = Arc::new(BookController::new(
            book_service.clone(),
            lock_manager.clone(),
            metadata_manager.clone(),
            epub_service.clone(),
            cover_service.clone(),
            metadata_service.clone(),
        ));

        let metadata_controller = Arc::new(MetadataController::new(
            pool.clone(),
            lock_manager.clone(),
            book_service.clone(),
            metadata_service.clone(),
            metadata_manager.clone(),
        ));

        let authentication_repository = Arc::new(AuthenticationRepository::new(pool.clone()));

        let authentication_service = Arc::new(
            AuthenticationService::new(
                pool.clone(),
                authentication_repository.clone(),
                &config.auth.jwt_key_path,
                config.auth.jwt_token_duration,
                config.auth.refresh_token_duration,
            )
            .await,
        );

        let shelf_service = Arc::new(ShelfService::new(pool.clone(), book_service.clone()));

        let shelf_controller = Arc::new(ShelfController::new(
            book_service.clone(),
            shelf_service.clone(),
            lock_manager.clone(),
            pool.clone(),
        ));

        let services = Services {
            book: book_service,
            shelf: shelf_service,
            authentication: authentication_service,
        };
        let controllers = Controllers {
            book: book_controller,
            cover: cover_controller,
            annotation: annotation_controller,
            metadata: metadata_controller,
            shelf: shelf_controller,
        };

        Self {
            config,
            pool: pool.clone(),
            metadata_manager,
            lock_manager,
            cache,
            services,
            controllers,
        }
    }
}
