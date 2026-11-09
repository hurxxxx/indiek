//! Per-IP request limits kept only in memory.
//!
//! Addresses are never stored. Each one is hashed with a random salt that is replaced, together
//! with every bucket, when the Korean date changes; the salt itself is never written anywhere.
//! IPv6 addresses are grouped by /64 so one host cannot rotate through its own prefix.

use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use axum::http::HeaderMap;
use sha2::{Digest, Sha256};
use time::OffsetDateTime;

/// Safety valve for the bucket map; idle buckets are dropped first.
const MAX_BUCKETS: usize = 100_000;
const KST_OFFSET_SECONDS: i64 = 9 * 3600;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Action {
    Vote,
    Request,
}

#[derive(Debug, Clone, Copy)]
pub struct Limit {
    pub burst: u32,
    pub refill_every: Duration,
}

#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub vote: Limit,
    pub request: Limit,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            // Allows a few retries and shared addresses (NAT) without inviting ballot stuffing.
            vote: Limit { burst: 5, refill_every: Duration::from_secs(5 * 60) },
            request: Limit { burst: 5, refill_every: Duration::from_secs(10 * 60) },
        }
    }
}

impl Limits {
    fn get(&self, action: Action) -> Limit {
        match action {
            Action::Vote => self.vote,
            Action::Request => self.request,
        }
    }
}

struct Bucket {
    tokens: f64,
    updated: Instant,
}

struct Inner {
    day: i64,
    salt: [u8; 32],
    buckets: HashMap<([u8; 16], Action), Bucket>,
}

pub struct RateLimiter {
    limits: Limits,
    inner: Mutex<Inner>,
}

impl RateLimiter {
    pub fn new(limits: Limits) -> Self {
        Self {
            limits,
            inner: Mutex::new(Inner { day: i64::MIN, salt: [0; 32], buckets: HashMap::new() }),
        }
    }

    /// Takes one token. `Err` carries how long until the next token.
    pub fn check(&self, action: Action, ip: IpAddr, now: Instant, day: i64) -> Result<(), Duration> {
        let limit = self.limits.get(action);
        let mut inner = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        inner.rotate(day);
        let key = (address_key(&inner.salt, ip), action);
        if inner.buckets.len() >= MAX_BUCKETS && !inner.buckets.contains_key(&key) {
            let limits = self.limits;
            inner.buckets.retain(|(_, action), bucket| !is_full(bucket, limits.get(*action), now));
            if inner.buckets.len() >= MAX_BUCKETS {
                inner.buckets.clear();
            }
        }
        let bucket = inner
            .buckets
            .entry(key)
            .or_insert(Bucket { tokens: f64::from(limit.burst), updated: now });
        refill(bucket, limit, now);
        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            Ok(())
        } else {
            let missing = 1.0 - bucket.tokens;
            Err(limit.refill_every.mul_f64(missing).max(Duration::from_secs(1)))
        }
    }

    /// Drops the salt and all buckets once the date has changed, even without new requests.
    pub fn rotate_if_needed(&self, day: i64) {
        self.inner.lock().unwrap_or_else(|e| e.into_inner()).rotate(day);
    }

    pub fn tracked(&self) -> usize {
        self.inner.lock().unwrap_or_else(|e| e.into_inner()).buckets.len()
    }
}

impl Inner {
    fn rotate(&mut self, day: i64) {
        if self.day != day {
            self.day = day;
            getrandom::fill(&mut self.salt).expect("operating system random source");
            self.buckets = HashMap::new();
        }
    }
}

fn refill(bucket: &mut Bucket, limit: Limit, now: Instant) {
    let elapsed = now.saturating_duration_since(bucket.updated);
    let gained = elapsed.as_secs_f64() / limit.refill_every.as_secs_f64();
    bucket.tokens = (bucket.tokens + gained).min(f64::from(limit.burst));
    bucket.updated = now;
}

fn is_full(bucket: &Bucket, limit: Limit, now: Instant) -> bool {
    let elapsed = now.saturating_duration_since(bucket.updated);
    bucket.tokens + elapsed.as_secs_f64() / limit.refill_every.as_secs_f64() >= f64::from(limit.burst)
}

fn address_key(salt: &[u8; 32], ip: IpAddr) -> [u8; 16] {
    let mut hasher = Sha256::new();
    hasher.update(salt);
    match normalize(ip) {
        IpAddr::V4(v4) => hasher.update(v4.octets()),
        IpAddr::V6(v6) => hasher.update(&v6.octets()[..8]),
    }
    let digest = hasher.finalize();
    let mut key = [0; 16];
    key.copy_from_slice(&digest[..16]);
    key
}

fn normalize(ip: IpAddr) -> IpAddr {
    match ip {
        IpAddr::V6(v6) => v6.to_ipv4_mapped().map_or(IpAddr::V6(v6), IpAddr::V4),
        v4 => v4,
    }
}

/// Day number in Korea time; the salt changes at midnight KST.
pub fn kst_day(now: OffsetDateTime) -> i64 {
    (now.unix_timestamp() + KST_OFFSET_SECONDS).div_euclid(86_400)
}

/// The visitor's address. `X-Real-IP` is trusted only from a loopback peer (the local Nginx).
pub fn client_ip(peer: SocketAddr, headers: &HeaderMap) -> IpAddr {
    if peer.ip().is_loopback()
        && let Some(ip) = headers
            .get("x-real-ip")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().parse().ok())
    {
        return ip;
    }
    peer.ip()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn limiter() -> RateLimiter {
        RateLimiter::new(Limits {
            vote: Limit { burst: 2, refill_every: Duration::from_secs(60) },
            request: Limit { burst: 1, refill_every: Duration::from_secs(60) },
        })
    }

    #[test]
    fn burst_then_refill() {
        let limiter = limiter();
        let ip: IpAddr = "203.0.113.7".parse().unwrap();
        let start = Instant::now();
        assert!(limiter.check(Action::Vote, ip, start, 1).is_ok());
        assert!(limiter.check(Action::Vote, ip, start, 1).is_ok());
        let wait = limiter.check(Action::Vote, ip, start, 1).unwrap_err();
        assert!(wait <= Duration::from_secs(60) && wait >= Duration::from_secs(1));
        assert!(limiter.check(Action::Vote, ip, start + Duration::from_secs(61), 1).is_ok());
        // Separate budget per action and per address.
        assert!(limiter.check(Action::Request, ip, start, 1).is_ok());
        assert!(limiter.check(Action::Vote, "203.0.113.8".parse().unwrap(), start, 1).is_ok());
    }

    #[test]
    fn new_day_forgets_everything() {
        let limiter = limiter();
        let ip: IpAddr = "203.0.113.7".parse().unwrap();
        let now = Instant::now();
        limiter.check(Action::Request, ip, now, 10).unwrap();
        assert!(limiter.check(Action::Request, ip, now, 10).is_err());
        let salt_before = limiter.inner.lock().unwrap().salt;
        limiter.rotate_if_needed(11);
        assert_eq!(limiter.tracked(), 0);
        assert_ne!(limiter.inner.lock().unwrap().salt, salt_before);
        assert!(limiter.check(Action::Request, ip, now, 11).is_ok());
    }

    #[test]
    fn ipv6_grouped_by_prefix() {
        let limiter = limiter();
        let now = Instant::now();
        limiter.check(Action::Request, "2001:db8:1:2::1".parse().unwrap(), now, 1).unwrap();
        assert!(limiter.check(Action::Request, "2001:db8:1:2::ffff".parse().unwrap(), now, 1).is_err());
        assert!(limiter.check(Action::Request, "2001:db8:1:3::1".parse().unwrap(), now, 1).is_ok());
        limiter.check(Action::Request, "198.51.100.1".parse().unwrap(), now, 1).unwrap();
        assert!(limiter.check(Action::Request, "::ffff:198.51.100.1".parse().unwrap(), now, 1).is_err());
    }

    #[test]
    fn keys_do_not_contain_the_address() {
        let salt = [7; 32];
        let ip: IpAddr = "198.51.100.23".parse().unwrap();
        let key = address_key(&salt, ip);
        assert_ne!(&key[..4], &[198, 51, 100, 23]);
        assert_ne!(key, address_key(&[8; 32], ip));
    }

    #[test]
    fn kst_midnight() {
        let before = OffsetDateTime::parse("2026-12-01T23:59:59+09:00", &time::format_description::well_known::Rfc3339).unwrap();
        let after = OffsetDateTime::parse("2026-12-02T00:00:00+09:00", &time::format_description::well_known::Rfc3339).unwrap();
        assert_eq!(kst_day(after) - kst_day(before), 1);
    }

    #[test]
    fn real_ip_only_from_local_proxy() {
        let mut headers = HeaderMap::new();
        headers.insert("x-real-ip", HeaderValue::from_static("198.51.100.9"));
        let local: SocketAddr = "127.0.0.1:50000".parse().unwrap();
        let remote: SocketAddr = "203.0.113.5:50000".parse().unwrap();
        assert_eq!(client_ip(local, &headers), "198.51.100.9".parse::<IpAddr>().unwrap());
        assert_eq!(client_ip(remote, &headers), remote.ip());
        assert_eq!(client_ip(local, &HeaderMap::new()), local.ip());
    }
}
