use std::net::SocketAddr;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::Router;
use axum::body::Body;
use axum::extract::connect_info::MockConnectInfo;
use axum::http::{Request, StatusCode, header};
use http_body_util::BodyExt;
use indiek_api::api::{AppState, ResultsCache, router};
use indiek_api::catalogue::{Catalogue, CatalogueStore};
use indiek_api::db::{Db, PollTally};
use indiek_api::ratelimit::{Limit, Limits, RateLimiter};
use indiek_api::{backup, db};
use serde_json::{Value, json};
use tempfile::TempDir;
use time::format_description::well_known::Rfc3339;
use time::{Duration as TimeDuration, OffsetDateTime};
use tower::ServiceExt;

const CATALOGUE_JS: &str = r#"export default {"site":{"url":"https://indiek.com"},"records":[
  {"id":"song-a","artistId":"artist-a","track":"A"},
  {"id":"song-b","artistId":"artist-b","featuredArtistIds":["artist-c"]},
  {"id":"song-c","artistId":"artist-c"}],
  "editorPick":{"id":"pick-song","artistId":"artist-d"},"featuredArtists":[],"listeningGuides":[]};
"#;

const TOKEN: &str = "AbCdEfGhIjKlMnOpQrStUv";

fn at(offset: TimeDuration) -> String {
    (OffsetDateTime::now_utc() + offset).format(&Rfc3339).unwrap()
}

fn polls_json() -> String {
    let day = TimeDuration::days(1);
    json!({
        "schemaVersion": 1,
        "polls": [
            {"id": "open-live", "title": "Live", "status": "published", "opensAt": at(-day), "closesAt": at(day),
             "choiceKind": "track", "maxChoices": 2, "resultsVisibility": "live"},
            {"id": "open-hidden", "status": "published", "opensAt": at(-day), "closesAt": at(day),
             "choiceKind": "track", "maxChoices": 3},
            {"id": "limited", "status": "published", "opensAt": at(-day), "closesAt": at(day),
             "choiceKind": "track", "choiceIds": ["song-a", "song-b"], "maxChoices": 1, "resultsVisibility": "live"},
            {"id": "artists", "status": "published", "opensAt": at(-day), "closesAt": at(day),
             "choiceKind": "artist", "maxChoices": 1, "resultsVisibility": "live"},
            {"id": "upcoming", "status": "published", "opensAt": at(day), "closesAt": at(day * 2),
             "choiceKind": "track", "maxChoices": 1},
            {"id": "ended", "status": "published", "opensAt": at(-day * 2), "closesAt": at(-day),
             "choiceKind": "track", "maxChoices": 1},
            {"id": "stopped", "status": "closed", "opensAt": at(-day), "closesAt": at(day),
             "choiceKind": "track", "maxChoices": 1},
            {"id": "secret", "status": "draft", "opensAt": at(-day), "closesAt": at(day),
             "choiceKind": "track", "maxChoices": 1, "resultsVisibility": "live"}
        ]
    })
    .to_string()
}

struct TestApp {
    router: Router,
    state: Arc<AppState>,
    _dir: TempDir,
}

async fn app_with(limits: Limits, cache: Duration) -> TestApp {
    let dir = tempfile::tempdir().unwrap();
    let catalogue = Catalogue::from_sources(CATALOGUE_JS, Some(&polls_json())).unwrap();
    let state = Arc::new(AppState {
        db: Db::open(&dir.path().join("test.sqlite3")).await.unwrap(),
        catalogue: Arc::new(CatalogueStore::fixed(catalogue)),
        limiter: RateLimiter::new(limits),
        results_cache: ResultsCache::new(cache),
        allowed_origins: vec!["https://indiek.com".into()],
    });
    let router = router(state.clone()).layer(MockConnectInfo(SocketAddr::from(([127, 0, 0, 1], 40000))));
    TestApp { router, state, _dir: dir }
}

fn generous() -> Limits {
    let limit = Limit { burst: 1000, refill_every: Duration::from_secs(1) };
    Limits { vote: limit, request: limit }
}

async fn app() -> TestApp {
    app_with(generous(), Duration::ZERO).await
}

async fn send(app: &TestApp, request: Request<Body>) -> (StatusCode, Value) {
    let response = app.router.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

fn post(uri: &str, body: Value) -> Request<Body> {
    Request::post(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .header("x-real-ip", "198.51.100.10")
        .body(Body::from(body.to_string()))
        .unwrap()
}

fn get(uri: &str) -> Request<Body> {
    Request::get(uri).body(Body::empty()).unwrap()
}

fn token(n: usize) -> String {
    format!("{TOKEN}{n:06}")
}

async fn vote(app: &TestApp, poll: &str, token: &str, choices: &[&str]) -> (StatusCode, Value) {
    send(app, post(&format!("/api/polls/{poll}/votes"), json!({ "token": token, "choices": choices }))).await
}

#[tokio::test]
async fn health_reports_catalogue_and_database() {
    let app = app().await;
    let (status, body) = send(&app, get("/api/health")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["tracks"], 4);
    assert_eq!(body["artists"], 4);
    assert_eq!(body["polls"], 7, "drafts are not counted");

    app.state.db.close().await;
    let (status, body) = send(&app, get("/api/health")).await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["status"], "degraded");
}

#[tokio::test]
async fn votes_are_counted_and_results_published() {
    let app = app().await;
    assert_eq!(vote(&app, "open-live", &token(1), &["song-a", "song-b"]).await.0, StatusCode::CREATED);
    assert_eq!(vote(&app, "open-live", &token(2), &["song-a"]).await.0, StatusCode::CREATED);
    assert_eq!(vote(&app, "open-live", &token(3), &["pick-song"]).await.0, StatusCode::CREATED);

    let response = app.router.clone().oneshot(get("/api/polls/open-live/results")).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[header::CACHE_CONTROL], "public, max-age=1");
    let body: Value = serde_json::from_slice(&response.into_body().collect().await.unwrap().to_bytes()).unwrap();
    assert_eq!(body["pollId"], "open-live");
    assert_eq!(body["state"], "open");
    assert_eq!(body["ballots"], 3);
    assert_eq!(
        body["results"],
        json!([{"id": "song-a", "votes": 2}, {"id": "pick-song", "votes": 1}, {"id": "song-b", "votes": 1}])
    );
}

#[tokio::test]
async fn a_token_votes_once_per_poll() {
    let app = app().await;
    assert_eq!(vote(&app, "open-live", TOKEN, &["song-a"]).await.0, StatusCode::CREATED);
    let (status, body) = vote(&app, "open-live", TOKEN, &["song-b"]).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["error"], "already_voted");
    // The same browser token may vote in a different poll.
    assert_eq!(vote(&app, "open-hidden", TOKEN, &["song-b"]).await.0, StatusCode::CREATED);

    let tally = app.state.db.poll_tally("open-live").await.unwrap();
    assert_eq!(tally, PollTally { ballots: 1, counts: vec![("song-a".into(), 1)] });
}

#[tokio::test]
async fn invalid_ballots_are_rejected_without_counting() {
    let app = app().await;
    let cases: &[(&str, Value, StatusCode, &str)] = &[
        ("open-live", json!({"token": "short", "choices": ["song-a"]}), StatusCode::BAD_REQUEST, "invalid_token"),
        ("open-live", json!({"token": TOKEN, "choices": []}), StatusCode::BAD_REQUEST, "invalid_choice_count"),
        ("open-live", json!({"token": TOKEN, "choices": ["song-a", "song-b", "song-c"]}), StatusCode::BAD_REQUEST, "invalid_choice_count"),
        ("open-live", json!({"token": TOKEN, "choices": ["song-a", "song-a"]}), StatusCode::BAD_REQUEST, "duplicate_choice"),
        ("open-live", json!({"token": TOKEN, "choices": ["no-such-song"]}), StatusCode::UNPROCESSABLE_ENTITY, "unknown_choice"),
        ("open-live", json!({"token": TOKEN, "choices": ["artist-a"]}), StatusCode::UNPROCESSABLE_ENTITY, "unknown_choice"),
        ("limited", json!({"token": TOKEN, "choices": ["song-c"]}), StatusCode::UNPROCESSABLE_ENTITY, "unknown_choice"),
        ("artists", json!({"token": TOKEN, "choices": ["song-a"]}), StatusCode::UNPROCESSABLE_ENTITY, "unknown_choice"),
        ("open-live", json!({"token": TOKEN, "choices": ["song-a"], "email": "a@b.co"}), StatusCode::BAD_REQUEST, "invalid_body"),
        ("no-such-poll", json!({"token": TOKEN, "choices": ["song-a"]}), StatusCode::NOT_FOUND, "unknown_poll"),
        ("Bad%20Id", json!({"token": TOKEN, "choices": ["song-a"]}), StatusCode::NOT_FOUND, "unknown_poll"),
        ("secret", json!({"token": TOKEN, "choices": ["song-a"]}), StatusCode::NOT_FOUND, "unknown_poll"),
        ("upcoming", json!({"token": TOKEN, "choices": ["song-a"]}), StatusCode::CONFLICT, "poll_not_open"),
        ("ended", json!({"token": TOKEN, "choices": ["song-a"]}), StatusCode::CONFLICT, "poll_closed"),
        ("stopped", json!({"token": TOKEN, "choices": ["song-a"]}), StatusCode::CONFLICT, "poll_closed"),
    ];
    for (poll, body, status, code) in cases {
        let (got, response) = send(&app, post(&format!("/api/polls/{poll}/votes"), body.clone())).await;
        assert_eq!((got, response["error"].as_str()), (*status, Some(*code)), "{poll} {body}");
    }
    assert_eq!(vote(&app, "artists", TOKEN, &["artist-c"]).await.0, StatusCode::CREATED);

    let wrong_type = Request::post("/api/polls/open-live/votes")
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::from(json!({"token": TOKEN, "choices": ["song-a"]}).to_string()))
        .unwrap();
    assert_eq!(send(&app, wrong_type).await, (StatusCode::UNSUPPORTED_MEDIA_TYPE, json!({"error": "json_required"})));
    let oversized = post("/api/polls/open-live/votes", json!({"token": TOKEN, "choices": ["x".repeat(8000)]}));
    assert_eq!(send(&app, oversized).await.0, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(app.state.db.poll_tally("open-live").await.unwrap().ballots, 0);
}

#[tokio::test]
async fn results_follow_poll_visibility() {
    let app = app().await;
    vote(&app, "open-hidden", &token(1), &["song-c"]).await;
    let (status, body) = send(&app, get("/api/polls/open-hidden/results")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["ballots"], 1);
    assert_eq!(body["results"], Value::Null, "counts stay hidden until the poll closes");

    let (_, body) = send(&app, get("/api/polls/ended/results")).await;
    assert_eq!((body["state"].as_str(), body["results"].clone()), (Some("closed"), json!([])));
    let (_, body) = send(&app, get("/api/polls/upcoming/results")).await;
    assert_eq!((body["state"].as_str(), body["results"].clone()), (Some("upcoming"), Value::Null));
    assert_eq!(send(&app, get("/api/polls/secret/results")).await.0, StatusCode::NOT_FOUND);
    assert_eq!(send(&app, get("/api/nothing")).await, (StatusCode::NOT_FOUND, json!({"error": "not_found"})));
}

#[tokio::test]
async fn results_are_cached_briefly() {
    let app = app_with(generous(), Duration::from_secs(60)).await;
    vote(&app, "open-live", &token(1), &["song-a"]).await;
    assert_eq!(send(&app, get("/api/polls/open-live/results")).await.1["ballots"], 1);
    vote(&app, "open-live", &token(2), &["song-a"]).await;
    assert_eq!(send(&app, get("/api/polls/open-live/results")).await.1["ballots"], 1, "served from memory");
    assert_eq!(app.state.db.poll_tally("open-live").await.unwrap().ballots, 2);
}

#[tokio::test]
async fn concurrent_votes_are_all_recorded() {
    let app = app().await;
    let tasks: Vec<_> = (0..20)
        .map(|n| {
            let router = app.router.clone();
            tokio::spawn(async move {
                let body = json!({"token": token(n), "choices": [if n % 2 == 0 { "song-a" } else { "song-b" }]});
                router.oneshot(post("/api/polls/open-live/votes", body)).await.unwrap().status()
            })
        })
        .collect();
    for task in tasks {
        assert_eq!(task.await.unwrap(), StatusCode::CREATED);
    }
    let tally = app.state.db.poll_tally("open-live").await.unwrap();
    assert_eq!(tally, PollTally { ballots: 20, counts: vec![("song-a".into(), 10), ("song-b".into(), 10)] });
}

#[tokio::test]
async fn posts_are_rate_limited_per_address() {
    let limit = Limit { burst: 2, refill_every: Duration::from_secs(3600) };
    let app = app_with(Limits { vote: limit, request: limit }, Duration::ZERO).await;
    assert_eq!(vote(&app, "open-live", &token(1), &["song-a"]).await.0, StatusCode::CREATED);
    assert_eq!(vote(&app, "open-live", &token(2), &["song-a"]).await.0, StatusCode::CREATED);
    let response = app
        .router
        .clone()
        .oneshot(post("/api/polls/open-live/votes", json!({"token": token(3), "choices": ["song-a"]})))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    let retry: u64 = response.headers()[header::RETRY_AFTER].to_str().unwrap().parse().unwrap();
    assert!((1..=3600).contains(&retry));

    let mut other = post("/api/polls/open-live/votes", json!({"token": token(4), "choices": ["song-a"]}));
    other.headers_mut().insert("x-real-ip", "198.51.100.11".parse().unwrap());
    assert_eq!(send(&app, other).await.0, StatusCode::CREATED);
    // Requests have their own budget.
    let request = post("/api/requests", json!({"type": "song", "trackId": "song-a"}));
    assert_eq!(send(&app, request).await.0, StatusCode::ACCEPTED);
}

#[tokio::test]
async fn cross_site_posts_are_refused() {
    let app = app().await;
    let mut foreign = post("/api/polls/open-live/votes", json!({"token": token(1), "choices": ["song-a"]}));
    foreign.headers_mut().insert(header::ORIGIN, "https://evil.example".parse().unwrap());
    assert_eq!(send(&app, foreign).await, (StatusCode::FORBIDDEN, json!({"error": "origin_not_allowed"})));

    let mut cross = post("/api/requests", json!({"type": "song", "trackId": "song-a"}));
    cross.headers_mut().insert("sec-fetch-site", "cross-site".parse().unwrap());
    assert_eq!(send(&app, cross).await.0, StatusCode::FORBIDDEN);

    let mut own = post("/api/polls/open-live/votes", json!({"token": token(2), "choices": ["song-a"]}));
    own.headers_mut().insert(header::ORIGIN, "https://indiek.com".parse().unwrap());
    own.headers_mut().insert("sec-fetch-site", "same-origin".parse().unwrap());
    assert_eq!(send(&app, own).await.0, StatusCode::CREATED);
}

#[tokio::test]
async fn requests_are_stored_privately_for_review() {
    let app = app().await;
    let accepted = [
        json!({"type": "song", "trackId": "song-b"}),
        json!({"type": "song", "artistId": "artist-a", "text": "  The   B-side\nplease "}),
        json!({"type": "song", "text": "Jannabi — for lovers who hesitate"}),
        json!({"type": "artist", "artistId": "artist-c"}),
        json!({"type": "artist", "text": "실리카겔", "trackId": null}),
    ];
    for body in &accepted {
        let (status, response) = send(&app, post("/api/requests", body.clone())).await;
        assert_eq!((status, response), (StatusCode::ACCEPTED, json!({"status": "received"})), "{body}");
    }
    let rejected: &[(Value, StatusCode, &str)] = &[
        (json!({"type": "song"}), StatusCode::BAD_REQUEST, "song_or_text_required"),
        (json!({"type": "song", "text": "   "}), StatusCode::BAD_REQUEST, "song_or_text_required"),
        (json!({"type": "artist", "trackId": "song-a"}), StatusCode::BAD_REQUEST, "track_not_allowed"),
        (json!({"type": "artist"}), StatusCode::BAD_REQUEST, "artist_or_text_required"),
        (json!({"type": "song", "trackId": "nope"}), StatusCode::UNPROCESSABLE_ENTITY, "unknown_track"),
        (json!({"type": "artist", "artistId": "nope"}), StatusCode::UNPROCESSABLE_ENTITY, "unknown_artist"),
        (json!({"type": "song", "text": "x".repeat(141)}), StatusCode::BAD_REQUEST, "text_too_long"),
        (json!({"type": "song", "text": "write to me@example.com"}), StatusCode::BAD_REQUEST, "text_has_contact"),
        (json!({"type": "song", "text": "https://youtu.be/x"}), StatusCode::BAD_REQUEST, "text_has_link"),
        (json!({"type": "song", "trackId": "song-a", "email": "me@example.com"}), StatusCode::BAD_REQUEST, "invalid_body"),
        (json!({"type": "lyrics", "trackId": "song-a"}), StatusCode::BAD_REQUEST, "invalid_body"),
    ];
    for (body, status, code) in rejected {
        let (got, response) = send(&app, post("/api/requests", body.clone())).await;
        assert_eq!((got, response["error"].as_str()), (*status, Some(*code)), "{body}");
    }

    let stored = app.state.db.list_requests(Some("pending"), 100).await.unwrap();
    assert_eq!(stored.len(), accepted.len());
    assert!(stored.iter().all(|r| r.status == "pending" && r.reviewed_at.is_none() && r.id.len() == 16));
    assert!(stored.iter().any(|r| r.kind == "song" && r.artist_id.as_deref() == Some("artist-a")
        && r.text.as_deref() == Some("The B-side please")));
    assert!(stored.iter().any(|r| r.kind == "artist" && r.text.as_deref() == Some("실리카겔")));
    // There is no public endpoint for reading requests.
    assert_eq!(send(&app, get("/api/requests")).await.0, StatusCode::METHOD_NOT_ALLOWED);
}

#[tokio::test]
async fn retention_cleanup_removes_expired_rows() {
    let app = app().await;
    let db = &app.state.db;
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let choices = vec!["song-a".to_string()];
    db.record_ballot("old-poll", "a".repeat(64).as_str(), &choices, now - 100, now - 1).await.unwrap();
    db.record_ballot("old-poll", "b".repeat(64).as_str(), &choices, now - 100, now + 1000).await.unwrap();
    send(&app, post("/api/requests", json!({"type": "song", "trackId": "song-a"}))).await;
    send(&app, post("/api/requests", json!({"type": "song", "trackId": "song-b"}))).await;
    let requests = db.list_requests(None, 10).await.unwrap();
    let old_review = now - db::DECLINED_REQUEST_RETENTION_SECONDS - 10;
    assert!(db.set_request_status(&requests[0].id, "declined", old_review).await.unwrap());
    assert!(db.set_request_status(&requests[1].id, "accepted", old_review).await.unwrap());
    assert!(!db.set_request_status("missing", "declined", now).await.unwrap());

    let report = db.cleanup(now).await.unwrap();
    assert_eq!((report.ballots, report.requests), (1, 1));
    let remaining = db.list_requests(None, 10).await.unwrap();
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].status, "accepted");
    // Counters survive ballot cleanup.
    assert_eq!(db.poll_tally("old-poll").await.unwrap().ballots, 2);
}

#[tokio::test]
async fn backups_are_consistent_copies_and_pruned() {
    let app = app().await;
    vote(&app, "open-live", &token(1), &["song-a"]).await;
    let database = app._dir.path().join("test.sqlite3");
    let dir = app._dir.path().join("backups");
    let start = OffsetDateTime::now_utc();
    let mut made = Vec::new();
    for hour in 0..3 {
        made.push(backup::run(&database, &dir, 2, start + TimeDuration::hours(hour)).await.unwrap());
    }
    let mut kept: Vec<_> = std::fs::read_dir(&dir).unwrap().map(|e| e.unwrap().path()).collect();
    kept.sort();
    assert_eq!(kept, made[1..].to_vec());
    assert!(backup::run(&database, &dir, 2, start + TimeDuration::hours(2)).await.is_err(), "never overwrites");

    let copy = Db::open(&made[2]).await.unwrap();
    assert_eq!(copy.poll_tally("open-live").await.unwrap().ballots, 1);
    copy.close().await;
    assert!(backup::run(Path::new("/nonexistent/db.sqlite3"), &dir, 2, start).await.is_err());
}

#[test]
fn catalogue_store_reloads_after_a_deploy() {
    let dir = tempfile::tempdir().unwrap();
    let site = dir.path().join("dist");
    std::fs::create_dir(&site).unwrap();
    let polls = dir.path().join("polls.json");
    std::fs::write(site.join("catalogue.js"), CATALOGUE_JS).unwrap();
    let store = CatalogueStore::open(site.clone(), polls.clone()).unwrap();
    assert_eq!(store.get().public_poll_count(), 0, "a missing polls file means no polls");
    assert!(!store.reload_if_changed().unwrap());

    let added = CATALOGUE_JS.replace(r#"{"id":"song-c""#, r#"{"id":"song-new","artistId":"artist-new"},{"id":"song-c""#);
    std::fs::write(site.join("catalogue.js"), &added).unwrap();
    std::fs::write(&polls, polls_json()).unwrap();
    assert!(store.reload_if_changed().unwrap());
    assert!(store.get().tracks.contains("song-new") && store.get().artists.contains("artist-new"));
    assert!(store.get().public_poll("open-live").is_some());

    std::fs::write(site.join("catalogue.js"), "export default {broken").unwrap();
    assert!(store.reload_if_changed().is_err());
    assert!(store.get().tracks.contains("song-new"), "keeps serving the last good catalogue");
    assert!(!store.reload_if_changed().unwrap(), "does not retry unchanged broken files");
}

#[test]
fn invalid_poll_definitions_are_refused() {
    let day = TimeDuration::days(1);
    let poll = |extra: Value| {
        let mut poll = json!({"id": "p", "status": "published", "opensAt": at(-day), "closesAt": at(day),
                              "choiceKind": "track", "maxChoices": 1});
        poll.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
        json!({"schemaVersion": 1, "polls": [poll]}).to_string()
    };
    assert!(Catalogue::from_sources(CATALOGUE_JS, Some(&poll(json!({})))).is_ok());
    for bad in [
        json!({"choiceIds": ["song-a", "missing"]}),
        json!({"choiceIds": ["song-a", "song-a"]}),
        json!({"choiceIds": ["song-a"], "maxChoices": 2}),
        json!({"closesAt": at(-day * 2)}),
        json!({"opensAt": "2026-12-01"}),
        json!({"maxChoices": 0}),
        json!({"maxChoices": 11}),
        json!({"id": "Not An Id"}),
        json!({"status": "open"}),
        json!({"choiceKind": "album"}),
    ] {
        assert!(Catalogue::from_sources(CATALOGUE_JS, Some(&poll(bad.clone()))).is_err(), "{bad}");
    }
    let single: Value = serde_json::from_str(&poll(json!({}))).unwrap();
    let duplicate = json!({"schemaVersion": 1, "polls": [single["polls"][0], single["polls"][0]]}).to_string();
    assert!(Catalogue::from_sources(CATALOGUE_JS, Some(&duplicate)).is_err());
    assert!(Catalogue::from_sources(CATALOGUE_JS, Some(r#"{"schemaVersion": 2, "polls": []}"#)).is_err());
    assert!(Catalogue::from_sources("const x = {}", None).is_err());
    assert!(Catalogue::from_sources(r#"export default {"records":[]};"#, None).is_err());
}

/// The repository's built catalogue and poll file must load, so a site build cannot silently
/// break the API.
#[test]
fn repository_catalogue_and_polls_load() {
    let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    let catalogue = Catalogue::load(&repo.join("dist"), &repo.join("content/polls.json")).unwrap();
    assert!(catalogue.tracks.len() >= 20 && catalogue.artists.len() >= 20);
    assert!(catalogue.tracks.contains("ydbb") && catalogue.artists.contains("hanroro"));
    assert!(catalogue.poll_ids().any(|id| id == "listeners-picks-2026"));
}

/// Handlers must not write addresses, tokens or request text to the log, even on errors.
#[tokio::test]
async fn logs_never_contain_addresses_tokens_or_text() {
    #[derive(Clone, Default)]
    struct Capture(Arc<Mutex<Vec<u8>>>);
    impl std::io::Write for Capture {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }
    let capture = Capture::default();
    let writer = capture.clone();
    let subscriber = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::TRACE)
        .with_ansi(false)
        .with_writer(move || writer.clone())
        .finish();
    let _guard = tracing::subscriber::set_default(subscriber);

    let app = app().await;
    vote(&app, "open-live", &token(7), &["song-a"]).await;
    send(&app, post("/api/requests", json!({"type": "song", "text": "Private wish 42"}))).await;
    app.state.db.close().await;
    assert_eq!(vote(&app, "open-live", &token(8), &["song-a"]).await.0, StatusCode::SERVICE_UNAVAILABLE);
    send(&app, post("/api/requests", json!({"type": "song", "text": "Private wish 43"}))).await;

    let log = String::from_utf8(capture.0.lock().unwrap().clone()).unwrap();
    assert!(log.contains("database error"), "capture works: {log}");
    for secret in [TOKEN, "198.51.100.10", "Private wish"] {
        assert!(!log.contains(secret), "log contains {secret}: {log}");
    }
}
