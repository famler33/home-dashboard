import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrationsDir, openDatabase } from './database.js';
import { runMigrations } from './migrate.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dashboard-migrate-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function migrationSet(name: string, files: Record<string, string>): string {
  const target = join(dir, name);
  mkdirSync(target, { recursive: true });
  for (const [file, sql] of Object.entries(files)) writeFileSync(join(target, file), sql);
  return target;
}

// Covers: AC-24, AC-30
describe('runMigrations', () => {
  it('applies migrations once and sets user_version', () => {
    const db = new Database(':memory:');
    const migrations = migrationSet('set', {
      '001_one.sql': 'CREATE TABLE one (id INTEGER);',
      '002_two.sql': 'CREATE TABLE two (id INTEGER);',
    });
    runMigrations(db, migrations);
    runMigrations(db, migrations);
    expect(db.pragma('user_version', { simple: true })).toBe(2);
    const tables = db
      .prepare("SELECT count(*) AS n FROM sqlite_master WHERE name IN ('one','two')")
      .get();
    expect(tables).toEqual({ n: 2 });
  });

  it('applies files in numeric order regardless of name length', () => {
    const db = new Database(':memory:');
    const migrations = migrationSet('set', {
      '010_ten.sql': 'INSERT INTO log VALUES (10);',
      '002_two.sql': 'INSERT INTO log VALUES (2);',
      '001_one.sql': 'CREATE TABLE log (n INTEGER);',
    });
    runMigrations(db, migrations);
    expect(db.prepare('SELECT n FROM log ORDER BY rowid').all()).toEqual([{ n: 2 }, { n: 10 }]);
  });

  it('rolls back a failing migration and keeps the previous version', () => {
    const db = new Database(':memory:');
    const migrations = migrationSet('set', {
      '001_ok.sql': 'CREATE TABLE ok (id INTEGER);',
      '002_bad.sql': 'CREATE TABLE half (id INTEGER); THIS IS NOT SQL;',
    });
    expect(() => runMigrations(db, migrations)).toThrow();
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'half'").get()).toBeUndefined();
  });

  it('refuses to start when user_version is newer than the app', () => {
    const db = new Database(':memory:');
    db.pragma('user_version = 7');
    const migrations = migrationSet('set', { '001_one.sql': 'CREATE TABLE one (id INTEGER);' });
    expect(() => runMigrations(db, migrations)).toThrowError(/DB_SCHEMA_NEWER_THAN_APP/);
  });

  it('upgrades an older database file in place and keeps its rows', () => {
    const path = join(dir, 'old.sqlite');
    const first = migrationSet('v1', { '001_one.sql': 'CREATE TABLE notes (text TEXT);' });
    const second = migrationSet('v2', {
      '001_one.sql': 'CREATE TABLE notes (text TEXT);',
      '002_add.sql': 'ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;',
    });
    const old = new Database(path);
    runMigrations(old, first);
    old.exec("INSERT INTO notes (text) VALUES ('kept');");
    old.close();

    const upgraded = new Database(path);
    runMigrations(upgraded, second);
    expect(upgraded.prepare('SELECT text, pinned FROM notes').all()).toEqual([
      { text: 'kept', pinned: 0 },
    ]);
    upgraded.close();
  });
});

describe('openDatabase', () => {
  it('opens in WAL mode with foreign keys and applies the shipped migrations', () => {
    const db = openDatabase(join(dir, 'dashboard.sqlite'));
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(1);
    expect(migrationsDir).toMatch(/migrations$/);
    db.close();
  });
});
