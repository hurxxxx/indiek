-- Standard SQL shared by SQLite and PostgreSQL. Timestamps are Unix seconds.

-- One row per ballot, holding only a hash of the browser's random token.
-- Rows are deleted at expires_at (after the poll closes); the counters below remain.
CREATE TABLE poll_ballots (
    poll_id    VARCHAR(80) NOT NULL,
    token_hash CHAR(64)    NOT NULL,
    created_at BIGINT      NOT NULL,
    expires_at BIGINT      NOT NULL,
    PRIMARY KEY (poll_id, token_hash)
);
CREATE INDEX poll_ballots_expires_at ON poll_ballots (expires_at);

-- Counter rows, updated with INSERT ... ON CONFLICT DO UPDATE.
CREATE TABLE poll_counts (
    poll_id   VARCHAR(80) NOT NULL,
    choice_id VARCHAR(80) NOT NULL,
    votes     BIGINT      NOT NULL,
    PRIMARY KEY (poll_id, choice_id)
);

CREATE TABLE poll_totals (
    poll_id VARCHAR(80) NOT NULL PRIMARY KEY,
    ballots BIGINT      NOT NULL
);

-- Reader requests stay private until an operator reviews them.
CREATE TABLE reader_requests (
    id          CHAR(16)     NOT NULL PRIMARY KEY,
    created_at  BIGINT       NOT NULL,
    kind        VARCHAR(16)  NOT NULL,
    track_id    VARCHAR(80),
    artist_id   VARCHAR(80),
    body        VARCHAR(560),
    status      VARCHAR(16)  NOT NULL,
    reviewed_at BIGINT
);
CREATE INDEX reader_requests_status ON reader_requests (status, created_at);
