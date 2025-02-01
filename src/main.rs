use config::Configuration;
use tokio::fs::create_dir_all;

mod app;
mod config;
mod database;

#[tokio::main]
async fn main() {
    let config = Configuration::new().unwrap();

    create_dir_all(&config.book_storage.epub_path).await.unwrap();
    create_dir_all(&config.book_storage.cover_path).await.unwrap();

    let db_pool = database::debug_init(&config.database.file_path).await;
    app::run(config, db_pool).await;
}
