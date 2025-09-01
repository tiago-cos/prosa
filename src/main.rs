#![allow(clippy::too_many_arguments)]
#![allow(clippy::enum_variant_names)]
#![allow(clippy::module_inception)]
#![allow(clippy::struct_field_names)]
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::match_bool)]
#![allow(clippy::unreadable_literal)]
#![allow(clippy::similar_names)]
#![allow(clippy::match_same_arms)]
#![allow(clippy::too_many_lines)]

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

    assert!(
        kepubify.exists() && kepubify.is_file(),
        "Kepubify must be present"
    );

    assert!(
        config.auth.admin_key.len() >= 16,
        "admin_key must be configured and at least 16 characters long"
    );

    assert!(
        config.auth.secret_key.len() >= 16,
        "secret_key must be configured and at least 16 characters long"
    );

    create_dir_all(&config.book_storage.epub_path).await.unwrap();
    create_dir_all(&config.book_storage.cover_path).await.unwrap();

    let db_pool = database::init(&config.database.file_path).await;

    println!(
        r"
 ───────────────────────────
  ____                      
 |  _ \ _ __ ___  ___  __ _ 
 | |_) | '__/ _ \/ __|/ _` |
 |  __/| | | (_) \__ \ (_| |
 |_|   |_|  \___/|___/\__,_|

 ───────────────────────────
        "
    );

    app::run(config, db_pool).await;
}
