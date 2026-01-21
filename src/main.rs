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
use sqlx::SqlitePool;
use std::{
    io::Error,
    path::Path,
    sync::{LazyLock, OnceLock},
};
use tokio::fs::create_dir_all;

mod app;
mod config;
mod database;

static DB_POOL: OnceLock<SqlitePool> = OnceLock::new();
static CONFIG: LazyLock<Configuration> =
    LazyLock::new(|| Configuration::new().expect("Failed to load configuration"));

#[tokio::main]
async fn main() {
    run_startup_checks().await.expect("Startup checks failed");

    let db_pool = database::init(&CONFIG.database.file_path).await;
    DB_POOL.set(db_pool).expect("Failed to set database pool");

    print_banner();

    app::run().await;
}

async fn run_startup_checks() -> Result<(), Box<dyn std::error::Error>> {
    let kepubify = Path::new(&CONFIG.kepubify.path);
    if !kepubify.exists() || !kepubify.is_file() {
        return Err("Kepubify must be present".into());
    }

    if CONFIG.auth.admin_key.len() < 8 {
        return Err("admin_key must be configured and at least 8 characters long".into());
    }

    create_parent_dir(&CONFIG.database.file_path).await?;
    create_parent_dir(&CONFIG.auth.public_key_path).await?;
    create_parent_dir(&CONFIG.auth.private_key_path).await?;
    create_dir_all(&CONFIG.book_storage.epub_path).await?;
    create_dir_all(&CONFIG.book_storage.cover_path).await?;

    Ok(())
}

async fn create_parent_dir(path: &str) -> Result<(), Error> {
    let path = Path::new(path);

    if !path.exists()
        && let Some(parent) = path.parent()
        && !parent.exists()
    {
        create_dir_all(parent).await?;
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
