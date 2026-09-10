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
use std::{io::Error, path::Path, sync::LazyLock};
use tokio::fs::create_dir_all;

mod app;
mod config;
mod database;

static CONFIG: LazyLock<Configuration> =
    LazyLock::new(|| Configuration::new().expect("Failed to load configuration"));

type StartupError = Box<dyn std::error::Error + Send + Sync>;

const USAGE: &str = "\
Prosa - a backend and API for managing eBook collections

Usage:
  prosa                        Run the server, applying any pending migrations
  prosa --migrate-status       Show applied and pending schema migrations
  prosa --migrate-down <ver>   Revert the schema down to version <ver>
  prosa --help                 Show this message

Downgrading:
  A binary can only revert migrations whose down scripts it carries, so run
  --migrate-down with the newer Prosa build *before* swapping in the older one.
";

enum Command {
    Serve,
    MigrateStatus,
    MigrateDown(i64),
}

#[tokio::main]
async fn main() {
    if let Err(error) = start().await {
        eprintln!("Error: {error}");
        std::process::exit(1);
    }
}

async fn start() -> Result<(), StartupError> {
    let Some(command) = parse_args()? else {
        print!("{USAGE}");
        return Ok(());
    };

    if matches!(command, Command::Serve) {
        print_banner();
    }

    app::init_logging();
    run_startup_checks().await?;

    match command {
        Command::MigrateStatus => {
            let pool = database::connect(&CONFIG.database.file_path).await?;
            let report = database::status(&pool).await?;
            pool.close().await;
            print!("{report}");
        }
        Command::MigrateDown(target) => {
            let pool = database::connect(&CONFIG.database.file_path).await?;
            let result = database::revert_to(&pool, target, &CONFIG.database.file_path).await;
            pool.close().await;
            result?;
        }
        Command::Serve => {
            let pool = database::init(&CONFIG.database.file_path).await?;
            database::set_pool(pool)?;
            app::run().await;
        }
    }

    Ok(())
}

fn parse_args() -> Result<Option<Command>, StartupError> {
    let mut args = std::env::args().skip(1);

    let command = match args.next().as_deref() {
        None => Command::Serve,
        Some("--help" | "-h") => return Ok(None),
        Some("--migrate-status") => Command::MigrateStatus,
        Some("--migrate-down") => {
            let target = args
                .next()
                .ok_or("--migrate-down requires a target schema version")?;

            let target = target
                .parse()
                .map_err(|_| format!("invalid target schema version '{target}'"))?;

            Command::MigrateDown(target)
        }
        Some(unknown) => return Err(format!("unknown argument '{unknown}'\n\n{USAGE}").into()),
    };

    if let Some(extra) = args.next() {
        return Err(format!("unexpected argument '{extra}'\n\n{USAGE}").into());
    }

    Ok(Some(command))
}

async fn run_startup_checks() -> Result<(), StartupError> {
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
