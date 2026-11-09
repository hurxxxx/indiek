//! Settings from environment variables. Defaults suit a local checkout; the systemd unit sets
//! production paths explicitly.

use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;

use crate::BoxError;

#[derive(Debug, Clone)]
pub struct Config {
    /// `INDIEK_API_BIND`, default `127.0.0.1:8787`. Keep it on loopback behind Nginx.
    pub bind: SocketAddr,
    /// `INDIEK_API_DB`, default `api/data/indiek-api.sqlite3`.
    pub database: PathBuf,
    /// `INDIEK_API_SITE_DIR`: the built site holding `catalogue.js`, default `dist`.
    pub site_dir: PathBuf,
    /// `INDIEK_API_POLLS`, default `content/polls.json`.
    pub polls: PathBuf,
    /// `INDIEK_API_ALLOWED_ORIGINS`, comma-separated, default `https://indiek.com`.
    pub allowed_origins: Vec<String>,
    /// `INDIEK_API_RESULTS_CACHE_SECONDS`, default 5.
    pub results_cache: Duration,
}

impl Config {
    pub fn from_env() -> Result<Self, BoxError> {
        let repo = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
        let path = |key: &str, default: PathBuf| env::var_os(key).map(PathBuf::from).unwrap_or(default);
        let bind = env::var("INDIEK_API_BIND").unwrap_or_else(|_| "127.0.0.1:8787".into());
        let cache_seconds = env::var("INDIEK_API_RESULTS_CACHE_SECONDS").unwrap_or_else(|_| "5".into());
        let origins = env::var("INDIEK_API_ALLOWED_ORIGINS").unwrap_or_else(|_| "https://indiek.com".into());
        Ok(Self {
            bind: bind.parse().map_err(|e| format!("INDIEK_API_BIND: {e}"))?,
            database: path("INDIEK_API_DB", repo.join("api/data/indiek-api.sqlite3")),
            site_dir: path("INDIEK_API_SITE_DIR", repo.join("dist")),
            polls: path("INDIEK_API_POLLS", repo.join("content/polls.json")),
            allowed_origins: origins.split(',').map(str::trim).filter(|o| !o.is_empty()).map(String::from).collect(),
            results_cache: Duration::from_secs(
                cache_seconds.parse().map_err(|e| format!("INDIEK_API_RESULTS_CACHE_SECONDS: {e}"))?,
            ),
        })
    }
}
