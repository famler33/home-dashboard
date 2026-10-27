CREATE TABLE source_state (
  source_id             TEXT    NOT NULL PRIMARY KEY,
  payload_json          TEXT,
  last_success_at       INTEGER,
  last_attempt_at       INTEGER,
  last_error_code       TEXT,
  consecutive_failures  INTEGER NOT NULL DEFAULT 0
) STRICT;
