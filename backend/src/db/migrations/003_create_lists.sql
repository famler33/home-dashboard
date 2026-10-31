CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  name_key   TEXT NOT NULL,
  position   INTEGER NOT NULL,
  builtin    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE UNIQUE INDEX categories_name_key ON categories (name_key) WHERE deleted_at IS NULL;

CREATE TABLE list_items (
  id           TEXT PRIMARY KEY,
  list         TEXT NOT NULL CHECK (list IN ('shopping', 'todo')),
  title        TEXT NOT NULL,
  title_key    TEXT NOT NULL,
  category_id  TEXT REFERENCES categories (id),
  priority     TEXT CHECK (priority IN ('high', 'medium', 'low')),
  effort_hours REAL,
  prerequisite TEXT,
  checked_at   INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER
);

CREATE INDEX list_items_list ON list_items (list, deleted_at, checked_at);

CREATE TABLE shopping_history (
  title_key TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  uses      INTEGER NOT NULL,
  last_used INTEGER NOT NULL
);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO meta (key, value) VALUES ('rev', '0');

INSERT INTO categories (id, name, name_key, position, builtin, created_at) VALUES
  ('wohnzimmer',   'Wohnzimmer',   'wohnzimmer',   1,  0, 0),
  ('buero',        'Büro',         'büro',         2,  0, 0),
  ('balkon',       'Balkon',       'balkon',       3,  0, 0),
  ('gang',         'Gang',         'gang',         4,  0, 0),
  ('grosses-bad',  'Großes Bad',   'großes bad',   5,  0, 0),
  ('kleines-bad',  'Kleines Bad',  'kleines bad',  6,  0, 0),
  ('kueche',       'Küche',        'küche',        7,  0, 0),
  ('schlafzimmer', 'Schlafzimmer', 'schlafzimmer', 8,  0, 0),
  ('kinderzimmer',   'Kinderzimmer',   'kinderzimmer',   9,  0, 0),
  ('sonstiges',    'Sonstiges',    'sonstiges',    10, 1, 0);
