use super::{annotations, books, covers, metadata, state, sync, users};
use crate::app::annotations::controller::AnnotationController;
use crate::app::annotations::repository::AnnotationRepository;
use crate::app::annotations::service::AnnotationService;
use crate::app::authentication::repository::AuthenticationRepository;
use crate::app::authentication::service::AuthenticationService;
use crate::app::books::controller::BookController;
use crate::app::books::repository::BookRepository;
use crate::app::books::service::BookService;
use crate::app::core::locking::service::LockService;
use crate::app::core::metadata_fetcher::MetadataFetcherService;
use crate::app::covers::controller::CoverController;
use crate::app::covers::repository::CoverRepository;
use crate::app::covers::service::CoverService;
use crate::app::epubs::repository::EpubRepository;
use crate::app::epubs::service::EpubService;
use crate::app::metadata::controller::MetadataController;
use crate::app::metadata::repository::MetadataRepository;
use crate::app::metadata::service::MetadataService;
use crate::app::shelves::controller::ShelfController;
use crate::app::shelves::repository::ShelfRepository;
use crate::app::shelves::service::ShelfService;
use crate::app::state::controller::StateController;
use crate::app::state::repository::StateRepository;
use crate::app::state::service::StateService;
use crate::app::sync::controller::SyncController;
use crate::app::sync::repository::SyncRepository;
use crate::app::sync::service::SyncService;
use crate::app::users::controller::UserController;
use crate::app::users::repository::UserRepository;
use crate::app::users::service::UserService;
use crate::app::{shelves, tracing};
use crate::config::Configuration;
use axum::Router;
use axum::http::StatusCode;
use axum::middleware::from_fn;
use axum::routing::get;
use log::info;
use quick_cache::sync::Cache as QuickCache;
use sqlx::SqlitePool;
use std::{collections::HashSet, sync::Arc};
use tokio::net::TcpListener;

pub type ImageCache = QuickCache<String, Arc<Vec<u8>>>;
pub type SourceCache = QuickCache<String, Arc<HashSet<String>>>;
pub type TagCache = QuickCache<String, Arc<HashSet<String>>>;
pub type TagLengthCache = QuickCache<String, u32>;

pub async fn run(config: Configuration, pool: SqlitePool) {
    let state = AppState::default(config.clone(), pool);
    let host = format!("{}:{}", &config.server.host, &config.server.port);

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
    pub services: Arc<Services>,
    pub controllers: Arc<Controllers>,
}

struct Repositories {
    annotation: Arc<AnnotationRepository>,
    authentication: Arc<AuthenticationRepository>,
    book: Arc<BookRepository>,
    cover: Arc<CoverRepository>,
    epub: Arc<EpubRepository>,
    metadata: Arc<MetadataRepository>,
    shelf: Arc<ShelfRepository>,
    state: Arc<StateRepository>,
    sync: Arc<SyncRepository>,
    user: Arc<UserRepository>,
}

pub struct Services {
    pub annotation: Arc<AnnotationService>,
    pub authentication: Arc<AuthenticationService>,
    pub book: Arc<BookService>,
    pub cover: Arc<CoverService>,
    pub epub: Arc<EpubService>,
    pub lock: Arc<LockService>,
    pub metadata: Arc<MetadataService>,
    pub metadata_fetcher: Arc<MetadataFetcherService>,
    pub shelf: Arc<ShelfService>,
    pub state: Arc<StateService>,
    pub sync: Arc<SyncService>,
    pub user: Arc<UserService>,
}

pub struct Controllers {
    pub annotation: Arc<AnnotationController>,
    pub book: Arc<BookController>,
    pub cover: Arc<CoverController>,
    pub metadata: Arc<MetadataController>,
    pub shelf: Arc<ShelfController>,
    pub state: Arc<StateController>,
    pub sync: Arc<SyncController>,
    pub user: Arc<UserController>,
}

struct Core {
    configuration: Arc<Configuration>,
    cache: Cache,
}

struct Cache {
    image_cache: Arc<ImageCache>,
    source_cache: Arc<SourceCache>,
    tag_cache: Arc<TagCache>,
    tag_length_cache: Arc<TagLengthCache>,
}

impl AppState {
    pub fn default(config: Configuration, pool: SqlitePool) -> Self {
        let core = Self::build_core(config);
        let repos = Self::build_repositories(pool);
        let services = Self::build_services(&core, &repos);
        let controllers = Self::build_controllers(&core, &services);

        Self {
            services: Arc::new(services),
            controllers: Arc::new(controllers),
        }
    }

    fn build_core(configuration: Configuration) -> Core {
        let configuration = Arc::new(configuration);
        let cache = Cache {
            image_cache: Arc::new(QuickCache::new(50)),
            source_cache: Arc::new(QuickCache::new(100000)),
            tag_cache: Arc::new(QuickCache::new(100000)),
            tag_length_cache: Arc::new(QuickCache::new(100000)),
        };

        Core { configuration, cache }
    }

    fn build_repositories(pool: SqlitePool) -> Repositories {
        Repositories {
            annotation: Arc::new(AnnotationRepository::new(pool.clone())),
            authentication: Arc::new(AuthenticationRepository::new(pool.clone())),
            book: Arc::new(BookRepository::new(pool.clone())),
            cover: Arc::new(CoverRepository::new(pool.clone())),
            epub: Arc::new(EpubRepository::new(pool.clone())),
            metadata: Arc::new(MetadataRepository::new(pool.clone())),
            shelf: Arc::new(ShelfRepository::new(pool.clone())),
            state: Arc::new(StateRepository::new(pool.clone())),
            sync: Arc::new(SyncRepository::new(pool.clone())),
            user: Arc::new(UserRepository::new(pool)),
        }
    }

    fn build_services(core: &Core, repos: &Repositories) -> Services {
        let user_service = Arc::new(UserService::new(repos.user.clone()));
        let book_service = Arc::new(BookService::new(repos.book.clone()));
        let metadata_service = Arc::new(MetadataService::new(repos.metadata.clone()));
        let lock_service = Arc::new(LockService::new(20));

        let authentication_service = Arc::new(AuthenticationService::new(
            repos.authentication.clone(),
            repos.user.clone(),
            &core.configuration.auth.jwt_key_path,
            core.configuration.auth.jwt_token_duration,
            core.configuration.auth.refresh_token_duration,
        ));

        let sync_service = Arc::new(SyncService::new(repos.sync.clone(), repos.user.clone()));

        let epub_service = Arc::new(EpubService::new(
            repos.epub.clone(),
            lock_service.clone(),
            core.configuration.kepubify.path.clone(),
            core.configuration.book_storage.epub_path.clone(),
        ));

        let cover_service = Arc::new(CoverService::new(
            lock_service.clone(),
            core.cache.image_cache.clone(),
            core.configuration.book_storage.cover_path.clone(),
            repos.cover.clone(),
        ));

        let annotation_service = Arc::new(AnnotationService::new(
            repos.annotation.clone(),
            repos.book.clone(),
            core.configuration.book_storage.epub_path.clone(),
            core.cache.source_cache.clone(),
            core.cache.tag_cache.clone(),
            core.cache.tag_length_cache.clone(),
        ));

        let metadata_fetcher_service = MetadataFetcherService::new(
            core.configuration.metadata_cooldown.epub_extractor,
            core.configuration.metadata_cooldown.goodreads,
            book_service.clone(),
            cover_service.clone(),
            epub_service.clone(),
            lock_service.clone(),
            metadata_service.clone(),
            sync_service.clone(),
        );

        let shelf_service = Arc::new(ShelfService::new(repos.shelf.clone(), book_service.clone()));

        let state_service = Arc::new(StateService::new(
            repos.state.clone(),
            core.configuration.book_storage.epub_path.clone(),
            core.cache.source_cache.clone(),
            core.cache.tag_cache.clone(),
        ));

        Services {
            annotation: annotation_service,
            authentication: authentication_service,
            book: book_service,
            cover: cover_service,
            epub: epub_service,
            lock: lock_service,
            metadata: metadata_service,
            metadata_fetcher: metadata_fetcher_service,
            shelf: shelf_service,
            state: state_service,
            sync: sync_service,
            user: user_service,
        }
    }

    fn build_controllers(core: &Core, services: &Services) -> Controllers {
        let book_controller = Arc::new(BookController::new(
            services.book.clone(),
            services.lock.clone(),
            services.metadata_fetcher.clone(),
            services.epub.clone(),
            services.cover.clone(),
            services.metadata.clone(),
            services.state.clone(),
            services.sync.clone(),
            services.user.clone(),
        ));

        let cover_controller = Arc::new(CoverController::new(
            services.lock.clone(),
            services.book.clone(),
            services.cover.clone(),
            services.sync.clone(),
        ));

        let annotation_controller = Arc::new(AnnotationController::new(
            services.lock.clone(),
            services.book.clone(),
            services.annotation.clone(),
            services.sync.clone(),
        ));

        let metadata_controller = Arc::new(MetadataController::new(
            services.lock.clone(),
            services.book.clone(),
            services.metadata.clone(),
            services.metadata_fetcher.clone(),
            services.sync.clone(),
            services.user.clone(),
        ));

        let shelf_controller = Arc::new(ShelfController::new(
            services.shelf.clone(),
            services.lock.clone(),
            services.sync.clone(),
            services.user.clone(),
        ));

        let state_controller = Arc::new(StateController::new(
            services.lock.clone(),
            services.book.clone(),
            services.state.clone(),
            services.sync.clone(),
        ));

        let sync_controller = Arc::new(SyncController::new(services.sync.clone()));

        let user_controller = Arc::new(UserController::new(
            &core.configuration.auth.admin_key,
            core.configuration.auth.allow_user_registration,
            services.authentication.clone(),
            services.user.clone(),
        ));

        Controllers {
            annotation: annotation_controller,
            book: book_controller,
            cover: cover_controller,
            metadata: metadata_controller,
            shelf: shelf_controller,
            state: state_controller,
            sync: sync_controller,
            user: user_controller,
        }
    }
}
