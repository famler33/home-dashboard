import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';

// Covers: FR-9, NFR-7, AC-3, AC-4, AC-30
describe('lists migration', () => {
  it('creates the lists schema and seeds the nine rooms and Sonstiges', () => {
    const db = new Database(':memory:');
    runMigrations(db, migrationsDir);
    const names = db.prepare('SELECT name FROM categories ORDER BY position').all() as {
      name: string;
    }[];
    expect(names.map((row) => row.name)).toEqual([
      'Wohnzimmer',
      'Büro',
      'Balkon',
      'Gang',
      'Großes Bad',
      'Kleines Bad',
      'Küche',
      'Schlafzimmer',
      'Kinderzimmer',
      'Sonstiges',
    ]);
    const builtin = db.prepare('SELECT id FROM categories WHERE builtin = 1').all() as {
      id: string;
    }[];
    expect(builtin).toEqual([{ id: 'sonstiges' }]);
    expect(db.prepare("SELECT value FROM meta WHERE key = 'rev'").get()).toEqual({ value: '0' });
  });

  it('keeps earlier tables intact when migrating from version 2 and is a no-op when run again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashboard-migrations-'));
    try {
      mkdirSync(join(dir, 'old'));
      for (const file of ['001_create_source_state.sql', '002_create_radar_document.sql']) {
        copyFileSync(join(migrationsDir, file), join(dir, 'old', file));
      }
      const db = new Database(':memory:');
      runMigrations(db, join(dir, 'old'));
      db.prepare(
        "INSERT INTO source_state (source_id, payload_json, last_success_at, last_attempt_at, consecutive_failures) VALUES ('demo', '{}', 1, 1, 0)",
      ).run();
      runMigrations(db, migrationsDir);
      expect(db.prepare('SELECT source_id FROM source_state').all()).toEqual([
        { source_id: 'demo' },
      ]);
      expect(db.prepare('SELECT COUNT(*) AS n FROM categories').get()).toEqual({ n: 10 });
      runMigrations(db, migrationsDir);
      expect(db.prepare('SELECT COUNT(*) AS n FROM categories').get()).toEqual({ n: 10 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps category names unique among non-deleted categories only', () => {
    const db = new Database(':memory:');
    runMigrations(db, migrationsDir);
    const insert = db.prepare(
      'INSERT INTO categories (id, name, name_key, position, builtin, created_at, deleted_at) VALUES (?, ?, ?, 99, 0, 1, ?)',
    );
    insert.run('a', 'Garten', 'garten', null);
    expect(() => insert.run('b', 'garten', 'garten', null)).toThrow();
    insert.run('c', 'Garten', 'garten', 5);
  });
});
