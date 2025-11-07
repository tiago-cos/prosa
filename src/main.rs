#![allow(clippy::too_many_arguments)]
#![allow(clippy::enum_variant_names)]
#![allow(clippy::module_inception)]
#![allow(clippy::struct_field_names)]
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::unreadable_literal)]
#![allow(clippy::similar_names)]
#![allow(clippy::match_same_arms)]
#![allow(clippy::too_many_lines)]

use config::Configuration;
use std::{io::Error, path::Path};
use tokio::fs::{self, create_dir_all};

mod app;
mod config;
mod database;

#[tokio::main]
async fn main() {
    let config = Configuration::new().expect("Failed to load configuration");

    run_startup_checks(&config).await.expect("Startup checks failed");

    let db_pool = database::init(&config.database.file_path).await;

    print_banner();

    app::run(config, db_pool).await;
}

async fn run_startup_checks(config: &Configuration) -> Result<(), Box<dyn std::error::Error>> {
    let kepubify = Path::new(&config.kepubify.path);
    if !kepubify.exists() || !kepubify.is_file() {
        return Err("Kepubify must be present".into());
    }

    if config.auth.admin_key.len() < 8 {
        return Err("admin_key must be configured and at least 8 characters long".into());
    }

    create_parent_dir(&config.database.file_path).await?;
    create_parent_dir(&config.auth.jwt_key_path).await?;
    create_dir_all(&config.book_storage.epub_path).await?;
    create_dir_all(&config.book_storage.cover_path).await?;

    Ok(())
}

async fn create_parent_dir(path: &str) -> Result<(), Error> {
    let path = Path::new(path);

    if !path.exists()
        && let Some(parent) = path.parent()
        && !parent.exists()
    {
        fs::create_dir_all(parent).await?;
    }

    Ok(())
}

fn print_banner() {
    println!(
        r"
 ───────────────────────────
  ____                      
 |  _ \ _ __ ___  ___  __ _ 
 | |_) | '__/ _ \/ __|/ _` |
 |  __/| | | (_) \__ \ (_| |
 |_|   |_|  \___||___/\__,_|

 ───────────────────────────
        "
    );
}
