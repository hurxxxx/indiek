use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Duration;

use indiek_api::api::{AppState, ResultsCache, router};
use indiek_api::catalogue::CatalogueStore;
use indiek_api::config::Config;
use indiek_api::db::{Db, REQUEST_STATUSES};
use indiek_api::ratelimit::{Limits, RateLimiter, kst_day};
use indiek_api::{BoxError, backup};
use time::OffsetDateTime;
use tracing_subscriber::EnvFilter;

const USAGE: &str = "\
indiek-api — participation API for indiek.com

USAGE:
  indiek-api [serve]                   Run the HTTP server
  indiek-api check                     Validate the public catalogue and polls, then exit
  indiek-api migrate                   Create or upgrade the database, then exit
  indiek-api backup DIR [--keep N]     VACUUM INTO DIR, keep the newest N copies (default 14)
  indiek-api cleanup                   Apply retention rules now (also runs hourly in serve)
  indiek-api requests [--status S] [--limit N]
                                       Print reader requests as JSON lines (default: pending)
  indiek-api request-status ID STATUS  Set STATUS: pending, accepted, declined or done

Settings come from INDIEK_API_* environment variables; see README.md.";

const CATALOGUE_RELOAD: Duration = Duration::from_secs(30);
const CLEANUP_INTERVAL: Duration = Duration::from_secs(3600);

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_ansi(std::io::IsTerminal::is_terminal(&std::io::stderr()))
        .with_writer(std::io::stderr)
        .init();
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("indiek-api: {error}");
            ExitCode::FAILURE
        }
    }
}

async fn run(args: &[String]) -> Result<(), BoxError> {
    let command = args.first().map(String::as_str).unwrap_or("serve");
    let rest = args.get(1..).unwrap_or_default();
    if matches!(command, "-h" | "--help" | "help") {
        println!("{USAGE}");
        return Ok(());
    }
    let config = Config::from_env()?;
    match command {
        "serve" => serve(config).await,
        "check" => {
            let store = CatalogueStore::open(config.site_dir.clone(), config.polls.clone())?;
            let catalogue = store.get();
            let mut polls: Vec<&str> = catalogue.poll_ids().collect();
            polls.sort_unstable();
            println!(
                "ok: {} tracks, {} artists, polls: {}",
                catalogue.tracks.len(),
                catalogue.artists.len(),
                if polls.is_empty() { "none".into() } else { polls.join(", ") }
            );
            Ok(())
        }
        "migrate" => {
            let db = open_db(&config.database).await?;
            db.close().await;
            println!("ok: {}", config.database.display());
            Ok(())
        }
        "backup" => {
            let dir = rest.first().filter(|a| !a.starts_with("--")).ok_or("backup needs a directory")?;
            let keep = flag(rest, "--keep")?.unwrap_or(backup::DEFAULT_KEEP);
            let path = backup::run(&config.database, Path::new(dir), keep, OffsetDateTime::now_utc()).await?;
            println!("ok: {}", path.display());
            Ok(())
        }
        "cleanup" => {
            let db = open_db(&config.database).await?;
            let report = db.cleanup(OffsetDateTime::now_utc().unix_timestamp()).await;
            db.close().await;
            let report = report?;
            println!("ok: removed {} ballot hashes, {} declined requests", report.ballots, report.requests);
            Ok(())
        }
        "requests" => {
            let status = match flag::<String>(rest, "--status")? {
                Some(s) if s == "all" => None,
                Some(s) => Some(known_status(&s)?.to_owned()),
                None => Some("pending".to_owned()),
            };
            let limit = flag(rest, "--limit")?.unwrap_or(200_i64);
            let db = open_db(&config.database).await?;
            let requests = db.list_requests(status.as_deref(), limit).await;
            db.close().await;
            for request in requests? {
                println!("{}", serde_json::to_string(&request)?);
            }
            Ok(())
        }
        "request-status" => {
            let [id, status] = rest else {
                return Err("usage: indiek-api request-status ID STATUS".into());
            };
            let status = known_status(status)?;
            let db = open_db(&config.database).await?;
            let changed = db.set_request_status(id, status, OffsetDateTime::now_utc().unix_timestamp()).await;
            db.close().await;
            if !changed? {
                return Err(format!("no request with id {id}").into());
            }
            println!("ok: {id} {status}");
            Ok(())
        }
        other => Err(format!("unknown command {other:?}\n\n{USAGE}").into()),
    }
}

fn known_status(status: &str) -> Result<&'static str, BoxError> {
    REQUEST_STATUSES
        .iter()
        .copied()
        .find(|known| *known == status)
        .ok_or_else(|| format!("status must be one of {}", REQUEST_STATUSES.join(", ")).into())
}

fn flag<T: std::str::FromStr>(args: &[String], name: &str) -> Result<Option<T>, BoxError> {
    match args.iter().position(|a| a == name) {
        None => Ok(None),
        Some(i) => {
            let value = args.get(i + 1).ok_or_else(|| format!("{name} needs a value"))?;
            value.parse().map(Some).map_err(|_| format!("invalid value for {name}: {value}").into())
        }
    }
}

async fn open_db(path: &PathBuf) -> Result<Db, BoxError> {
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        std::fs::create_dir_all(parent)?;
    }
    Ok(Db::open(path).await?)
}

async fn serve(config: Config) -> Result<(), BoxError> {
    let catalogue = Arc::new(CatalogueStore::open(config.site_dir.clone(), config.polls.clone())?);
    let db = open_db(&config.database).await?;
    let state = Arc::new(AppState {
        db: db.clone(),
        catalogue: catalogue.clone(),
        limiter: RateLimiter::new(Limits::default()),
        results_cache: ResultsCache::new(config.results_cache),
        allowed_origins: config.allowed_origins.clone(),
    });

    let reload = tokio::spawn({
        let catalogue = catalogue.clone();
        async move {
            let mut tick = tokio::time::interval(CATALOGUE_RELOAD);
            loop {
                tick.tick().await;
                match catalogue.reload_if_changed() {
                    Ok(true) => {
                        let current = catalogue.get();
                        tracing::info!(tracks = current.tracks.len(), artists = current.artists.len(), "catalogue reloaded");
                    }
                    Ok(false) => {}
                    Err(error) => tracing::error!(%error, "catalogue reload failed; keeping the previous catalogue"),
                }
            }
        }
    });
    let cleanup = tokio::spawn({
        let state = state.clone();
        async move {
            let mut tick = tokio::time::interval(CLEANUP_INTERVAL);
            loop {
                tick.tick().await;
                let now = OffsetDateTime::now_utc();
                state.limiter.rotate_if_needed(kst_day(now));
                match state.db.cleanup(now.unix_timestamp()).await {
                    Ok(report) if report.ballots + report.requests > 0 => {
                        tracing::info!(ballots = report.ballots, requests = report.requests, "retention cleanup");
                    }
                    Ok(_) => {}
                    Err(error) => tracing::error!(%error, "retention cleanup failed"),
                }
            }
        }
    });

    let listener = tokio::net::TcpListener::bind(config.bind).await?;
    tracing::info!(bind = %config.bind, "indiek-api listening");
    let served = axum::serve(listener, router(state).into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown_signal())
        .await;
    reload.abort();
    cleanup.abort();
    db.close().await;
    tracing::info!("indiek-api stopped");
    Ok(served?)
}

async fn shutdown_signal() {
    let interrupt = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        () = interrupt => {}
        () = terminate => {}
    }
}
