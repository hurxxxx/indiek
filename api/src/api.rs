//! HTTP routes. Every response is JSON; errors are `{"error": "<code>"}`.
//!
//! Handlers never log addresses, tokens or request text.

use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::body::Bytes;
use axum::extract::rejection::JsonRejection;
use axum::extract::{ConnectInfo, DefaultBodyLimit, Path, Request, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use crate::catalogue::{CatalogueStore, PollState};
use crate::db::{BallotOutcome, Db, NewRequest};
use crate::ratelimit::{Action, RateLimiter, client_ip, kst_day};
use crate::validate::{self, ballot_hash, clean_request_text, valid_id, valid_token};

const BODY_LIMIT: usize = 4 * 1024;
const HANDLER_TIMEOUT: Duration = Duration::from_secs(10);
/// Ballot hashes are kept this long after a poll closes, then deleted by the cleanup job.
pub const BALLOT_RETENTION_AFTER_CLOSE_SECONDS: i64 = 30 * 86_400;

pub struct AppState {
    pub db: Db,
    pub catalogue: Arc<CatalogueStore>,
    pub limiter: RateLimiter,
    pub results_cache: ResultsCache,
    /// Browser origins allowed to send votes and requests (for example `https://indiek.com`).
    pub allowed_origins: Vec<String>,
}

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/polls/{id}/votes", post(vote))
        .route("/api/polls/{id}/results", get(results))
        .route("/api/requests", post(create_request))
        .fallback(|| async { ApiError::new(StatusCode::NOT_FOUND, "not_found") })
        .layer(DefaultBodyLimit::max(BODY_LIMIT))
        .layer(middleware::from_fn(guard))
        .with_state(state)
}

/// Time limit and default headers for every response.
async fn guard(request: Request, next: Next) -> Response {
    let mut response = match tokio::time::timeout(HANDLER_TIMEOUT, next.run(request)).await {
        Ok(response) => response,
        Err(_) => ApiError::unavailable().into_response(),
    };
    let headers = response.headers_mut();
    headers.entry(header::CACHE_CONTROL).or_insert(HeaderValue::from_static("no-store"));
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    response
}

#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    code: &'static str,
    retry_after: Option<Duration>,
}

impl ApiError {
    fn new(status: StatusCode, code: &'static str) -> Self {
        Self { status, code, retry_after: None }
    }

    fn bad_request(code: &'static str) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code)
    }

    fn unavailable() -> Self {
        Self::new(StatusCode::SERVICE_UNAVAILABLE, "unavailable")
    }

    fn body(rejection: JsonRejection) -> Self {
        match rejection.status() {
            StatusCode::UNSUPPORTED_MEDIA_TYPE => Self::new(StatusCode::UNSUPPORTED_MEDIA_TYPE, "json_required"),
            StatusCode::PAYLOAD_TOO_LARGE => Self::new(StatusCode::PAYLOAD_TOO_LARGE, "body_too_large"),
            _ => Self::bad_request("invalid_body"),
        }
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        // sqlx errors carry SQL text and driver messages, never bound values.
        tracing::error!(%error, "database error");
        Self::unavailable()
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let mut response = (self.status, Json(json!({ "error": self.code }))).into_response();
        if let Some(wait) = self.retry_after {
            let seconds = wait.as_secs_f64().ceil() as u64;
            response.headers_mut().insert(header::RETRY_AFTER, HeaderValue::from(seconds));
        }
        response
    }
}

/// Cross-site browser posts are refused; requests without `Origin` (curl, tests) are allowed.
fn check_origin(headers: &HeaderMap, allowed: &[String]) -> Result<(), ApiError> {
    let forbidden = || ApiError::new(StatusCode::FORBIDDEN, "origin_not_allowed");
    if headers.get("sec-fetch-site").is_some_and(|site| site == "cross-site") {
        return Err(forbidden());
    }
    match headers.get(header::ORIGIN) {
        Some(origin) if !allowed.iter().any(|a| origin == a.as_str()) => Err(forbidden()),
        _ => Ok(()),
    }
}

fn limit(state: &AppState, action: Action, peer: SocketAddr, headers: &HeaderMap, now: OffsetDateTime) -> Result<(), ApiError> {
    let ip = client_ip(peer, headers);
    state.limiter.check(action, ip, Instant::now(), kst_day(now)).map_err(|wait| ApiError {
        status: StatusCode::TOO_MANY_REQUESTS,
        code: "rate_limited",
        retry_after: Some(wait),
    })
}

async fn health(State(state): State<Arc<AppState>>) -> Response {
    let catalogue = state.catalogue.get();
    let database = state.db.ping().await.is_ok();
    let status = if database { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    let body = json!({
        "status": if database { "ok" } else { "degraded" },
        "database": database,
        "tracks": catalogue.tracks.len(),
        "artists": catalogue.artists.len(),
        "polls": catalogue.public_poll_count(),
    });
    (status, Json(body)).into_response()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct VoteBody {
    token: String,
    choices: Vec<String>,
}

async fn vote(
    State(state): State<Arc<AppState>>,
    Path(poll_id): Path<String>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Result<Json<VoteBody>, JsonRejection>,
) -> Result<Response, ApiError> {
    let now = OffsetDateTime::now_utc();
    check_origin(&headers, &state.allowed_origins)?;
    limit(&state, Action::Vote, peer, &headers, now)?;
    let Json(body) = body.map_err(ApiError::body)?;

    let catalogue = state.catalogue.get();
    let poll = valid_id(&poll_id)
        .then(|| catalogue.public_poll(&poll_id))
        .flatten()
        .ok_or(ApiError::new(StatusCode::NOT_FOUND, "unknown_poll"))?;
    match poll.state(now) {
        PollState::Open => {}
        PollState::Upcoming => return Err(ApiError::new(StatusCode::CONFLICT, "poll_not_open")),
        PollState::Closed => return Err(ApiError::new(StatusCode::CONFLICT, "poll_closed")),
    }
    if !valid_token(&body.token) {
        return Err(ApiError::bad_request("invalid_token"));
    }
    if body.choices.is_empty() || body.choices.len() > poll.max_choices {
        return Err(ApiError::bad_request("invalid_choice_count"));
    }
    if body.choices.iter().collect::<HashSet<_>>().len() != body.choices.len() {
        return Err(ApiError::bad_request("duplicate_choice"));
    }
    if !body.choices.iter().all(|choice| catalogue.is_valid_choice(poll, choice)) {
        return Err(ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "unknown_choice"));
    }

    let expires_at = poll.closes_at.unix_timestamp() + BALLOT_RETENTION_AFTER_CLOSE_SECONDS;
    let hash = ballot_hash(&poll.id, &body.token);
    match state.db.record_ballot(&poll.id, &hash, &body.choices, now.unix_timestamp(), expires_at).await? {
        BallotOutcome::Recorded => Ok((StatusCode::CREATED, Json(json!({ "status": "recorded" }))).into_response()),
        BallotOutcome::AlreadyVoted => Err(ApiError::new(StatusCode::CONFLICT, "already_voted")),
    }
}

async fn results(State(state): State<Arc<AppState>>, Path(poll_id): Path<String>) -> Result<Response, ApiError> {
    let now = OffsetDateTime::now_utc();
    let catalogue = state.catalogue.get();
    let poll = valid_id(&poll_id)
        .then(|| catalogue.public_poll(&poll_id))
        .flatten()
        .ok_or(ApiError::new(StatusCode::NOT_FOUND, "unknown_poll"))?;

    let body = match state.results_cache.get(&poll.id) {
        Some(body) => body,
        None => {
            let tally = state.db.poll_tally(&poll.id).await?;
            let visible = poll.results_visible(now);
            let results = visible.then(|| {
                tally
                    .counts
                    .iter()
                    .filter(|(choice, _)| catalogue.is_valid_choice(poll, choice))
                    .map(|(choice, votes)| json!({ "id": choice, "votes": votes }))
                    .collect::<Vec<_>>()
            });
            let body = json!({
                "pollId": poll.id,
                "state": poll.state(now),
                "opensAt": format_time(poll.opens_at),
                "closesAt": format_time(poll.closes_at),
                "ballots": tally.ballots,
                "results": results,
                "generatedAt": format_time(now),
            });
            let bytes = Bytes::from(serde_json::to_vec(&body).expect("JSON value serializes"));
            state.results_cache.insert(&poll.id, bytes.clone());
            bytes
        }
    };
    let max_age = format!("public, max-age={}", state.results_cache.ttl.as_secs().max(1));
    Ok((
        [
            (header::CONTENT_TYPE, HeaderValue::from_static("application/json")),
            (header::CACHE_CONTROL, HeaderValue::from_str(&max_age).expect("ASCII header")),
        ],
        body,
    )
        .into_response())
}

fn format_time(value: OffsetDateTime) -> String {
    value.format(&Rfc3339).unwrap_or_default()
}

#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum RequestKind {
    Song,
    Artist,
}

/// No contact fields exist; unknown fields (such as `email`) are rejected.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RequestBody {
    #[serde(rename = "type")]
    kind: RequestKind,
    track_id: Option<String>,
    artist_id: Option<String>,
    text: Option<String>,
}

async fn create_request(
    State(state): State<Arc<AppState>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Result<Json<RequestBody>, JsonRejection>,
) -> Result<Response, ApiError> {
    let now = OffsetDateTime::now_utc();
    check_origin(&headers, &state.allowed_origins)?;
    limit(&state, Action::Request, peer, &headers, now)?;
    let Json(body) = body.map_err(ApiError::body)?;

    let catalogue = state.catalogue.get();
    let text = match body.text.as_deref().map(str::trim).filter(|t| !t.is_empty()) {
        Some(text) => Some(clean_request_text(text).map_err(|e| ApiError::bad_request(e.code()))?),
        None => None,
    };
    if body.track_id.as_ref().is_some_and(|id| !catalogue.tracks.contains(id)) {
        return Err(ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "unknown_track"));
    }
    if body.artist_id.as_ref().is_some_and(|id| !catalogue.artists.contains(id)) {
        return Err(ApiError::new(StatusCode::UNPROCESSABLE_ENTITY, "unknown_artist"));
    }
    let kind = match body.kind {
        RequestKind::Song if body.track_id.is_none() && text.is_none() => {
            return Err(ApiError::bad_request("song_or_text_required"));
        }
        RequestKind::Song => "song",
        RequestKind::Artist if body.track_id.is_some() => return Err(ApiError::bad_request("track_not_allowed")),
        RequestKind::Artist if body.artist_id.is_none() && text.is_none() => {
            return Err(ApiError::bad_request("artist_or_text_required"));
        }
        RequestKind::Artist => "artist",
    };

    let mut id = [0u8; 8];
    getrandom::fill(&mut id).map_err(|_| ApiError::unavailable())?;
    let request = NewRequest {
        id: validate::hex(&id),
        created_at: now.unix_timestamp(),
        kind,
        track_id: body.track_id,
        artist_id: body.artist_id,
        text,
    };
    state.db.insert_request(&request).await?;
    Ok((StatusCode::ACCEPTED, Json(json!({ "status": "received" }))).into_response())
}

/// Serialized results per poll for a few seconds, so bursts of readers hit memory, not SQLite.
pub struct ResultsCache {
    ttl: Duration,
    entries: Mutex<HashMap<String, (Instant, Bytes)>>,
}

impl ResultsCache {
    pub fn new(ttl: Duration) -> Self {
        Self { ttl, entries: Mutex::new(HashMap::new()) }
    }

    fn get(&self, poll_id: &str) -> Option<Bytes> {
        let entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        entries
            .get(poll_id)
            .filter(|(stored, _)| stored.elapsed() < self.ttl)
            .map(|(_, body)| body.clone())
    }

    fn insert(&self, poll_id: &str, body: Bytes) {
        if self.ttl.is_zero() {
            return;
        }
        let mut entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        entries.retain(|_, (stored, _)| stored.elapsed() < self.ttl);
        entries.insert(poll_id.to_owned(), (Instant::now(), body));
    }
}
