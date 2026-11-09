//! indiek participation API: listener polls and reader requests.
//!
//! The static site never depends on this service. Pages, playback and Saved work without it;
//! participation widgets hide their counts when it is unavailable.

pub mod api;
pub mod backup;
pub mod catalogue;
pub mod config;
pub mod db;
pub mod ratelimit;
pub mod validate;

pub type BoxError = Box<dyn std::error::Error + Send + Sync>;
