use config::Configuration;
use std::path::Path;
use tokio::fs::create_dir_all;

mod app;
mod config;
mod database;
mod metadata_manager;

#[tokio::main]
async fn main() {
    let config = Configuration::new().unwrap();
    let kepubify = Path::new(&config.kepubify.path);
    if !kepubify.exists() || !kepubify.is_file() {
        panic!("Kepubify must be present");
    }

    create_dir_all(&config.book_storage.epub_path).await.unwrap();
    create_dir_all(&config.book_storage.cover_path).await.unwrap();

    let db_pool = database::debug_init(&config.database.file_path).await;
    app::run(config, db_pool).await;
}
