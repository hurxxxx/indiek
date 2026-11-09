//! Daily database copies: `VACUUM INTO` a temporary name, rename, keep the newest N.

use std::fs;
use std::path::{Path, PathBuf};

use time::OffsetDateTime;
use time::macros::{format_description, offset};

use crate::BoxError;
use crate::db;

const PREFIX: &str = "indiek-api-";
const SUFFIX: &str = ".sqlite3";
pub const DEFAULT_KEEP: usize = 14;

/// Writes `indiek-api-YYYYMMDD-HHMMSS.sqlite3` (Korea time) into `dir` and prunes older copies.
pub async fn run(database: &Path, dir: &Path, keep: usize, now: OffsetDateTime) -> Result<PathBuf, BoxError> {
    if keep == 0 {
        return Err("keep must be at least 1".into());
    }
    if !database.is_file() {
        return Err(format!("database {} does not exist", database.display()).into());
    }
    fs::create_dir_all(dir)?;
    let stamp = now
        .to_offset(offset!(+9))
        .format(format_description!("[year][month][day]-[hour][minute][second]"))?;
    let target = dir.join(format!("{PREFIX}{stamp}{SUFFIX}"));
    if target.exists() {
        return Err(format!("{} already exists", target.display()).into());
    }
    let partial = dir.join(format!(".{PREFIX}{stamp}{SUFFIX}.partial"));
    let _ = fs::remove_file(&partial);
    if let Err(error) = db::vacuum_into(database, &partial).await {
        let _ = fs::remove_file(&partial);
        return Err(error.into());
    }
    fs::rename(&partial, &target)?;
    prune(dir, keep)?;
    Ok(target)
}

/// Deletes all but the newest `keep` backups. Names sort chronologically.
fn prune(dir: &Path, keep: usize) -> Result<(), BoxError> {
    let mut backups: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(PREFIX) && n.ends_with(SUFFIX))
        })
        .collect();
    backups.sort();
    let excess = backups.len().saturating_sub(keep);
    for old in &backups[..excess] {
        fs::remove_file(old)?;
    }
    Ok(())
}
