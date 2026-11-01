CREATE TABLE radar_document (
  id         INTEGER NOT NULL PRIMARY KEY CHECK (id = 1),
  version    TEXT    NOT NULL,
  body_gzip  BLOB    NOT NULL,
  saved_at   INTEGER NOT NULL
) STRICT;
