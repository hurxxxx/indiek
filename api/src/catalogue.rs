//! Public IDs the API accepts.
//!
//! Track and artist IDs come from the built site (`dist/catalogue.js`), so the API only accepts
//! what visitors can actually see. Poll definitions come from a small JSON file
//! (`content/polls.json` by default); every choice in a poll must exist in that same catalogue.
//! Draft polls are never exposed.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

use crate::BoxError;
use crate::validate::valid_id;

pub const MAX_CHOICES_LIMIT: usize = 10;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ChoiceKind {
    Track,
    Artist,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PollStatus {
    /// Not public: votes and results return 404.
    Draft,
    /// Public; voting follows `opensAt`/`closesAt`.
    Published,
    /// Public, voting stopped early.
    Closed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum ResultsVisibility {
    /// Per-choice counts are public while voting is open.
    Live,
    /// Only the ballot total is public until the poll closes.
    #[default]
    AfterClose,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PollState {
    Upcoming,
    Open,
    Closed,
}

#[derive(Debug, Clone)]
pub struct Poll {
    pub id: String,
    pub status: PollStatus,
    pub opens_at: OffsetDateTime,
    pub closes_at: OffsetDateTime,
    pub choice_kind: ChoiceKind,
    /// `None` means every public track (or artist) is a valid choice.
    pub choice_ids: Option<HashSet<String>>,
    pub max_choices: usize,
    pub results_visibility: ResultsVisibility,
}

impl Poll {
    pub fn state(&self, now: OffsetDateTime) -> PollState {
        if self.status == PollStatus::Closed || now >= self.closes_at {
            PollState::Closed
        } else if now < self.opens_at {
            PollState::Upcoming
        } else {
            PollState::Open
        }
    }

    pub fn results_visible(&self, now: OffsetDateTime) -> bool {
        match (self.results_visibility, self.state(now)) {
            (_, PollState::Upcoming) => false,
            (ResultsVisibility::Live, _) => true,
            (ResultsVisibility::AfterClose, state) => state == PollState::Closed,
        }
    }
}

#[derive(Debug, Default)]
pub struct Catalogue {
    pub tracks: HashSet<String>,
    pub artists: HashSet<String>,
    polls: HashMap<String, Poll>,
}

impl Catalogue {
    /// Parses the built `catalogue.js` and an optional polls file.
    pub fn from_sources(catalogue_js: &str, polls_json: Option<&str>) -> Result<Self, BoxError> {
        let mut catalogue = parse_catalogue_js(catalogue_js)?;
        if let Some(polls) = polls_json {
            catalogue.polls = parse_polls(polls, &catalogue)?;
        }
        Ok(catalogue)
    }

    pub fn load(site_dir: &Path, polls_path: &Path) -> Result<Self, BoxError> {
        let catalogue_path = site_dir.join("catalogue.js");
        let catalogue_js = fs::read_to_string(&catalogue_path)
            .map_err(|e| format!("cannot read {}: {e}", catalogue_path.display()))?;
        let polls_json = match fs::read_to_string(polls_path) {
            Ok(text) => Some(text),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
            Err(e) => return Err(format!("cannot read {}: {e}", polls_path.display()).into()),
        };
        Self::from_sources(&catalogue_js, polls_json.as_deref())
            .map_err(|e| format!("invalid public catalogue or polls: {e}").into())
    }

    /// A poll visitors may see. Drafts are treated as unknown.
    pub fn public_poll(&self, id: &str) -> Option<&Poll> {
        self.polls.get(id).filter(|poll| poll.status != PollStatus::Draft)
    }

    pub fn public_poll_count(&self) -> usize {
        self.polls.values().filter(|p| p.status != PollStatus::Draft).count()
    }

    pub fn poll_ids(&self) -> impl Iterator<Item = &str> {
        self.polls.keys().map(String::as_str)
    }

    pub fn is_valid_choice(&self, poll: &Poll, id: &str) -> bool {
        let public = match poll.choice_kind {
            ChoiceKind::Track => self.tracks.contains(id),
            ChoiceKind::Artist => self.artists.contains(id),
        };
        public && poll.choice_ids.as_ref().is_none_or(|ids| ids.contains(id))
    }
}

#[derive(Deserialize)]
struct RawCatalogue {
    records: Vec<RawTrack>,
    #[serde(rename = "editorPick")]
    editor_pick: Option<RawTrack>,
}

#[derive(Deserialize)]
struct RawTrack {
    id: String,
    #[serde(rename = "artistId")]
    artist_id: String,
    #[serde(rename = "featuredArtistIds", default)]
    featured_artist_ids: Vec<String>,
}

/// `dist/catalogue.js` is `export default {JSON};`. Read only the IDs.
fn parse_catalogue_js(source: &str) -> Result<Catalogue, BoxError> {
    let start = source.find('{').ok_or("catalogue.js has no object")?;
    let end = source.rfind('}').ok_or("catalogue.js has no object")?;
    if end < start || !source[..start].trim().starts_with("export default") {
        return Err("catalogue.js is not `export default {...}`".into());
    }
    let raw: RawCatalogue = serde_json::from_str(&source[start..=end])?;
    let mut catalogue = Catalogue::default();
    for track in raw.records.iter().chain(raw.editor_pick.iter()) {
        if !valid_id(&track.id) || !valid_id(&track.artist_id) {
            return Err(format!("catalogue has an unexpected ID: {}", track.id).into());
        }
        catalogue.tracks.insert(track.id.clone());
        catalogue.artists.insert(track.artist_id.clone());
        for featured in &track.featured_artist_ids {
            catalogue.artists.insert(featured.clone());
        }
    }
    if catalogue.tracks.is_empty() {
        return Err("catalogue has no tracks".into());
    }
    Ok(catalogue)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPollFile {
    schema_version: u32,
    polls: Vec<RawPoll>,
}

// Copy fields such as `title` may be added for the site; the API ignores them.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPoll {
    id: String,
    status: PollStatus,
    opens_at: String,
    closes_at: String,
    choice_kind: ChoiceKind,
    #[serde(default)]
    choice_ids: Option<Vec<String>>,
    max_choices: usize,
    #[serde(default)]
    results_visibility: ResultsVisibility,
}

fn parse_polls(source: &str, catalogue: &Catalogue) -> Result<HashMap<String, Poll>, BoxError> {
    let file: RawPollFile = serde_json::from_str(source)?;
    if file.schema_version != 1 {
        return Err(format!("unsupported polls schemaVersion {}", file.schema_version).into());
    }
    let mut polls = HashMap::new();
    for raw in file.polls {
        let id = raw.id.clone();
        let poll = validate_poll(raw, catalogue).map_err(|e| format!("poll {id}: {e}"))?;
        if polls.insert(id.clone(), poll).is_some() {
            return Err(format!("duplicate poll id {id}").into());
        }
    }
    Ok(polls)
}

fn validate_poll(raw: RawPoll, catalogue: &Catalogue) -> Result<Poll, BoxError> {
    if !valid_id(&raw.id) {
        return Err("id must use lowercase letters, digits and hyphens".into());
    }
    let opens_at = OffsetDateTime::parse(&raw.opens_at, &Rfc3339)
        .map_err(|e| format!("opensAt is not RFC 3339: {e}"))?;
    let closes_at = OffsetDateTime::parse(&raw.closes_at, &Rfc3339)
        .map_err(|e| format!("closesAt is not RFC 3339: {e}"))?;
    if closes_at <= opens_at {
        return Err("closesAt must be after opensAt".into());
    }
    if raw.max_choices == 0 || raw.max_choices > MAX_CHOICES_LIMIT {
        return Err(format!("maxChoices must be 1–{MAX_CHOICES_LIMIT}").into());
    }
    let public = match raw.choice_kind {
        ChoiceKind::Track => &catalogue.tracks,
        ChoiceKind::Artist => &catalogue.artists,
    };
    let choice_ids = match raw.choice_ids {
        None => None,
        Some(ids) => {
            let set: HashSet<String> = ids.iter().cloned().collect();
            if set.len() != ids.len() {
                return Err("choiceIds contains duplicates".into());
            }
            if let Some(missing) = ids.iter().find(|id| !public.contains(*id)) {
                return Err(format!("choice {missing} is not in the public catalogue").into());
            }
            Some(set)
        }
    };
    let available = choice_ids.as_ref().map_or(public.len(), HashSet::len);
    if raw.max_choices > available {
        return Err("maxChoices exceeds the number of choices".into());
    }
    Ok(Poll {
        id: raw.id,
        status: raw.status,
        opens_at,
        closes_at,
        choice_kind: raw.choice_kind,
        choice_ids,
        max_choices: raw.max_choices,
        results_visibility: raw.results_visibility,
    })
}

type Stamp = Option<(SystemTime, u64)>;

/// Holds the current catalogue and reloads it when the site is redeployed.
pub struct CatalogueStore {
    sources: Option<(PathBuf, PathBuf)>,
    stamps: Mutex<(Stamp, Stamp)>,
    current: RwLock<Arc<Catalogue>>,
}

impl CatalogueStore {
    pub fn open(site_dir: PathBuf, polls_path: PathBuf) -> Result<Self, BoxError> {
        let stamps = (stamp(&site_dir.join("catalogue.js")), stamp(&polls_path));
        let catalogue = Catalogue::load(&site_dir, &polls_path)?;
        Ok(Self {
            sources: Some((site_dir, polls_path)),
            stamps: Mutex::new(stamps),
            current: RwLock::new(Arc::new(catalogue)),
        })
    }

    /// A catalogue that never reloads (tests and one-off commands).
    pub fn fixed(catalogue: Catalogue) -> Self {
        Self {
            sources: None,
            stamps: Mutex::new((None, None)),
            current: RwLock::new(Arc::new(catalogue)),
        }
    }

    pub fn get(&self) -> Arc<Catalogue> {
        self.current.read().unwrap_or_else(|e| e.into_inner()).clone()
    }

    /// Reloads when either source file changed. On error the previous catalogue stays active
    /// and the same files are not retried (or reported) again until they change.
    pub fn reload_if_changed(&self) -> Result<bool, BoxError> {
        let Some((site_dir, polls_path)) = &self.sources else {
            return Ok(false);
        };
        let next = (stamp(&site_dir.join("catalogue.js")), stamp(polls_path));
        let mut stamps = self.stamps.lock().unwrap_or_else(|e| e.into_inner());
        if *stamps == next {
            return Ok(false);
        }
        *stamps = next;
        let catalogue = Catalogue::load(site_dir, polls_path)?;
        *self.current.write().unwrap_or_else(|e| e.into_inner()) = Arc::new(catalogue);
        Ok(true)
    }
}

fn stamp(path: &Path) -> Stamp {
    let meta = fs::metadata(path).ok()?;
    Some((meta.modified().ok()?, meta.len()))
}
