//! All database access lives here.
//!
//! SQLite runs in WAL mode with `synchronous=NORMAL` and a busy timeout. Writes go through a
//! single connection; reads use a separate read-only pool. Queries are standard SQL with `$n`
//! placeholders (numbered in order of first use, which SQLite and PostgreSQL both accept) and
//! `ON CONFLICT` upserts, so moving to PostgreSQL means swapping the pool types here.

use std::path::Path;
use std::time::Duration;

use serde::Serialize;
use sqlx::Row;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions, SqliteSynchronous};

const BUSY_TIMEOUT: Duration = Duration::from_secs(5);
const READ_CONNECTIONS: u32 = 4;

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BallotOutcome {
    Recorded,
    AlreadyVoted,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct PollTally {
    pub ballots: i64,
    /// `(choice_id, votes)`, most votes first, ties by ID.
    pub counts: Vec<(String, i64)>,
}

#[derive(Debug, Clone)]
pub struct NewRequest {
    pub id: String,
    pub created_at: i64,
    pub kind: &'static str,
    pub track_id: Option<String>,
    pub artist_id: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredRequest {
    pub id: String,
    pub created_at: i64,
    pub kind: String,
    pub track_id: Option<String>,
    pub artist_id: Option<String>,
    pub text: Option<String>,
    pub status: String,
    pub reviewed_at: Option<i64>,
}

pub const REQUEST_STATUSES: [&str; 4] = ["pending", "accepted", "declined", "done"];

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct CleanupReport {
    pub ballots: u64,
    pub requests: u64,
}

/// Declined requests are deleted this long after review.
pub const DECLINED_REQUEST_RETENTION_SECONDS: i64 = 30 * 86_400;

#[derive(Clone)]
pub struct Db {
    writer: SqlitePool,
    reader: SqlitePool,
}

impl Db {
    /// Opens (creating if needed) the database and applies pending migrations.
    pub async fn open(path: &Path) -> Result<Self, sqlx::Error> {
        let writer = SqlitePoolOptions::new()
            .max_connections(1)
            .acquire_timeout(BUSY_TIMEOUT)
            .connect_with(
                SqliteConnectOptions::new()
                    .filename(path)
                    .create_if_missing(true)
                    .journal_mode(SqliteJournalMode::Wal)
                    .synchronous(SqliteSynchronous::Normal)
                    .busy_timeout(BUSY_TIMEOUT)
                    .foreign_keys(true),
            )
            .await?;
        MIGRATOR.run(&writer).await?;
        let reader = SqlitePoolOptions::new()
            .max_connections(READ_CONNECTIONS)
            .acquire_timeout(BUSY_TIMEOUT)
            .connect_with(SqliteConnectOptions::new().filename(path).read_only(true).busy_timeout(BUSY_TIMEOUT))
            .await?;
        Ok(Self { writer, reader })
    }

    pub async fn close(&self) {
        self.reader.close().await;
        self.writer.close().await;
    }

    pub async fn ping(&self) -> Result<(), sqlx::Error> {
        sqlx::query("SELECT 1").execute(&self.reader).await.map(|_| ())
    }

    /// Records one ballot. The token hash is unique per poll, so a repeated token changes nothing.
    pub async fn record_ballot(
        &self,
        poll_id: &str,
        token_hash: &str,
        choices: &[String],
        now: i64,
        expires_at: i64,
    ) -> Result<BallotOutcome, sqlx::Error> {
        let mut tx = self.writer.begin().await?;
        let inserted = sqlx::query(
            "INSERT INTO poll_ballots (poll_id, token_hash, created_at, expires_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (poll_id, token_hash) DO NOTHING",
        )
        .bind(poll_id)
        .bind(token_hash)
        .bind(now)
        .bind(expires_at)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if inserted == 0 {
            tx.rollback().await?;
            return Ok(BallotOutcome::AlreadyVoted);
        }
        for choice in choices {
            sqlx::query(
                "INSERT INTO poll_counts (poll_id, choice_id, votes) VALUES ($1, $2, 1)
                 ON CONFLICT (poll_id, choice_id) DO UPDATE SET votes = poll_counts.votes + 1",
            )
            .bind(poll_id)
            .bind(choice)
            .execute(&mut *tx)
            .await?;
        }
        sqlx::query(
            "INSERT INTO poll_totals (poll_id, ballots) VALUES ($1, 1)
             ON CONFLICT (poll_id) DO UPDATE SET ballots = poll_totals.ballots + 1",
        )
        .bind(poll_id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(BallotOutcome::Recorded)
    }

    pub async fn poll_tally(&self, poll_id: &str) -> Result<PollTally, sqlx::Error> {
        let ballots: Option<i64> = sqlx::query_scalar("SELECT ballots FROM poll_totals WHERE poll_id = $1")
            .bind(poll_id)
            .fetch_optional(&self.reader)
            .await?;
        let counts = sqlx::query(
            "SELECT choice_id, votes FROM poll_counts WHERE poll_id = $1 ORDER BY votes DESC, choice_id",
        )
        .bind(poll_id)
        .fetch_all(&self.reader)
        .await?
        .into_iter()
        .map(|row| Ok((row.try_get("choice_id")?, row.try_get("votes")?)))
        .collect::<Result<_, sqlx::Error>>()?;
        Ok(PollTally { ballots: ballots.unwrap_or(0), counts })
    }

    pub async fn insert_request(&self, request: &NewRequest) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO reader_requests (id, created_at, kind, track_id, artist_id, body, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')",
        )
        .bind(&request.id)
        .bind(request.created_at)
        .bind(request.kind)
        .bind(&request.track_id)
        .bind(&request.artist_id)
        .bind(&request.text)
        .execute(&self.writer)
        .await
        .map(|_| ())
    }

    pub async fn list_requests(&self, status: Option<&str>, limit: i64) -> Result<Vec<StoredRequest>, sqlx::Error> {
        let rows = match status {
            Some(status) => {
                sqlx::query(
                    "SELECT id, created_at, kind, track_id, artist_id, body, status, reviewed_at
                     FROM reader_requests WHERE status = $1 ORDER BY created_at, id LIMIT $2",
                )
                .bind(status)
                .bind(limit)
                .fetch_all(&self.reader)
                .await?
            }
            None => {
                sqlx::query(
                    "SELECT id, created_at, kind, track_id, artist_id, body, status, reviewed_at
                     FROM reader_requests ORDER BY created_at, id LIMIT $1",
                )
                .bind(limit)
                .fetch_all(&self.reader)
                .await?
            }
        };
        rows.into_iter()
            .map(|row| {
                Ok(StoredRequest {
                    id: row.try_get("id")?,
                    created_at: row.try_get("created_at")?,
                    kind: row.try_get("kind")?,
                    track_id: row.try_get("track_id")?,
                    artist_id: row.try_get("artist_id")?,
                    text: row.try_get("body")?,
                    status: row.try_get("status")?,
                    reviewed_at: row.try_get("reviewed_at")?,
                })
            })
            .collect()
    }

    /// Returns false when no request has that ID.
    pub async fn set_request_status(&self, id: &str, status: &str, now: i64) -> Result<bool, sqlx::Error> {
        let reviewed_at = (status != "pending").then_some(now);
        let changed = sqlx::query("UPDATE reader_requests SET status = $1, reviewed_at = $2 WHERE id = $3")
            .bind(status)
            .bind(reviewed_at)
            .bind(id)
            .execute(&self.writer)
            .await?
            .rows_affected();
        Ok(changed > 0)
    }

    /// Applies the retention rules: expired ballot hashes and old declined requests.
    pub async fn cleanup(&self, now: i64) -> Result<CleanupReport, sqlx::Error> {
        let ballots = sqlx::query("DELETE FROM poll_ballots WHERE expires_at < $1")
            .bind(now)
            .execute(&self.writer)
            .await?
            .rows_affected();
        let requests = sqlx::query("DELETE FROM reader_requests WHERE status = 'declined' AND reviewed_at < $1")
            .bind(now - DECLINED_REQUEST_RETENTION_SECONDS)
            .execute(&self.writer)
            .await?
            .rows_affected();
        Ok(CleanupReport { ballots, requests })
    }
}

/// Writes a consistent copy of `source` to `target` (which must not exist) with `VACUUM INTO`,
/// then checks the copy. Uses its own connection, so it can run beside the server.
pub async fn vacuum_into(source: &Path, target: &Path) -> Result<(), sqlx::Error> {
    let options = SqliteConnectOptions::new().filename(source).busy_timeout(BUSY_TIMEOUT);
    let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await?;
    let result = sqlx::query("VACUUM INTO $1")
        .bind(target.to_string_lossy().into_owned())
        .execute(&pool)
        .await;
    pool.close().await;
    result?;
    let copy = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(SqliteConnectOptions::new().filename(target).read_only(true))
        .await?;
    let check: String = sqlx::query_scalar("PRAGMA quick_check").fetch_one(&copy).await?;
    copy.close().await;
    if check == "ok" {
        Ok(())
    } else {
        Err(sqlx::Error::Protocol(format!("backup quick_check failed: {check}")))
    }
}
