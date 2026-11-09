//! Input rules shared by the handlers.

use sha2::{Digest, Sha256};

pub const ID_MAX: usize = 80;
pub const TOKEN_MIN: usize = 22;
pub const TOKEN_MAX: usize = 64;
pub const REQUEST_TEXT_MAX: usize = 140;

/// Catalogue and poll IDs: lowercase letters, digits and inner hyphens.
pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= ID_MAX
        && !id.starts_with('-')
        && !id.ends_with('-')
        && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

/// The browser's random voting token: at least 128 bits as base64url or hex.
pub fn valid_token(token: &str) -> bool {
    (TOKEN_MIN..=TOKEN_MAX).contains(&token.len())
        && token.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// Stored instead of the token. Scoped by poll so ballots cannot be linked across polls.
pub fn ballot_hash(poll_id: &str, token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"indiek-poll-ballot:v1:");
    hasher.update(poll_id.as_bytes());
    hasher.update(b":");
    hasher.update(token.as_bytes());
    hex(&hasher.finalize())
}

pub fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(DIGITS[(byte >> 4) as usize] as char);
        out.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    out
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextError {
    Empty,
    TooLong,
    /// Links are not accepted; requests name a song or artist.
    Link,
    /// Looks like an email address or phone number. No contact details are collected.
    Contact,
    /// Control or bidirectional override characters.
    Characters,
}

impl TextError {
    pub fn code(self) -> &'static str {
        match self {
            TextError::Empty => "text_empty",
            TextError::TooLong => "text_too_long",
            TextError::Link => "text_has_link",
            TextError::Contact => "text_has_contact",
            TextError::Characters => "text_invalid_characters",
        }
    }
}

/// Collapses whitespace and checks a short free-text request.
pub fn clean_request_text(input: &str) -> Result<String, TextError> {
    let text = input.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.is_empty() {
        return Err(TextError::Empty);
    }
    if text.chars().count() > REQUEST_TEXT_MAX {
        return Err(TextError::TooLong);
    }
    if text.chars().any(|c| c.is_control() || is_bidi_control(c) || c == '\u{feff}') {
        return Err(TextError::Characters);
    }
    let lower = text.to_lowercase();
    if lower.contains("://") || lower.contains("www.") {
        return Err(TextError::Link);
    }
    if looks_like_email(&text) || has_phone_number(&text) {
        return Err(TextError::Contact);
    }
    Ok(text)
}

fn is_bidi_control(c: char) -> bool {
    matches!(c, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}' | '\u{200e}' | '\u{200f}')
}

fn looks_like_email(text: &str) -> bool {
    text.split_whitespace().any(|word| {
        word.split_once('@').is_some_and(|(local, domain)| {
            local.chars().any(char::is_alphanumeric)
                && domain
                    .split_once('.')
                    .is_some_and(|(host, tld)| !host.is_empty() && tld.chars().any(char::is_alphabetic))
        })
    })
}

/// Nine or more digits written together (spaces, dots, dashes, brackets and `+` allowed between).
fn has_phone_number(text: &str) -> bool {
    let mut digits = 0;
    for c in text.chars() {
        if c.is_ascii_digit() {
            digits += 1;
            if digits >= 9 {
                return true;
            }
        } else if !matches!(c, ' ' | '-' | '.' | '(' | ')' | '+') {
            digits = 0;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids() {
        assert!(valid_id("listeners-picks-2026"));
        assert!(valid_id("ydbb"));
        assert!(!valid_id(""));
        assert!(!valid_id("Upper"));
        assert!(!valid_id("-lead"));
        assert!(!valid_id("trail-"));
        assert!(!valid_id("../etc"));
        assert!(!valid_id(&"a".repeat(ID_MAX + 1)));
    }

    #[test]
    fn tokens() {
        assert!(valid_token("AbCdEfGhIjKlMnOpQrStUv"));
        assert!(valid_token(&"0123456789abcdef".repeat(2)));
        assert!(!valid_token("short"));
        assert!(!valid_token(&"a".repeat(TOKEN_MAX + 1)));
        assert!(!valid_token("AbCdEfGhIjKlMnOpQrStU="));
    }

    #[test]
    fn ballot_hash_is_scoped_by_poll() {
        let token = "AbCdEfGhIjKlMnOpQrStUv";
        let a = ballot_hash("poll-a", token);
        assert_eq!(a.len(), 64);
        assert_ne!(a, ballot_hash("poll-b", token));
        assert!(!a.contains(token));
    }

    #[test]
    fn request_text() {
        assert_eq!(clean_request_text("  Jannabi   —\n“for lovers who hesitate” "), Ok("Jannabi — “for lovers who hesitate”".into()));
        assert_eq!(clean_request_text("자우림 - 스물다섯, 스물하나"), Ok("자우림 - 스물다섯, 스물하나".into()));
        assert_eq!(clean_request_text("Song 1994 by 0310"), Ok("Song 1994 by 0310".into()));
        assert_eq!(clean_request_text("   "), Err(TextError::Empty));
        assert_eq!(clean_request_text(&"가".repeat(REQUEST_TEXT_MAX + 1)), Err(TextError::TooLong));
        assert!(clean_request_text(&"가".repeat(REQUEST_TEXT_MAX)).is_ok());
        assert_eq!(clean_request_text("see https://example.com"), Err(TextError::Link));
        assert_eq!(clean_request_text("www.example.com please"), Err(TextError::Link));
        assert_eq!(clean_request_text("mail me at fan@example.com"), Err(TextError::Contact));
        assert_eq!(clean_request_text("call +82 10-1234-5678"), Err(TextError::Contact));
        assert_eq!(clean_request_text("bad \u{202e}text"), Err(TextError::Characters));
        assert!(clean_request_text("@artist_handle new single").is_ok());
    }
}
