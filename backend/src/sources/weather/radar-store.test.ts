import { gunzipSync } from 'node:zlib';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { migrationsDir } from '../../db/database.js';
import { runMigrations } from '../../db/migrate.js';
import { createRadarStore, type RadarStore } from './radar-store.js';
import type { RadarDocument } from './types.js';

function doc(version: string): RadarDocument {
  return {
    version,
    size: 101,
    corners: [
      [12.7, 52.9],
      [12.6, 52.1],
      [14.0, 52.0],
      [14.1, 52.9],
    ],
    home: { col: 50, row: 50, lat: 52.52, lon: 13.4 },
    map: { zoom: 9, tileSize: 256, tiles: [{ x: 274, y: 168 }] },
    frames: [{ time: version, kind: 'observed', values: 'AAAA' }],
  };
}

let db: Database.Database;
let store: RadarStore;

beforeEach(() => {
  db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  store = createRadarStore(db);
});

// Covers: FR-7, FR-8, AC-16, AC-24
describe('radar document table', () => {
  it('is created by the migrations as a single-row table', () => {
    expect(db.pragma('user_version', { simple: true })).toBeGreaterThanOrEqual(2);
    expect(() =>
      db
        .prepare(
          'INSERT INTO radar_document (id, version, body_gzip, saved_at) VALUES (2, ?, ?, 0)',
        )
        .run('v', Buffer.from('x')),
    ).toThrow();
  });
});

describe('RadarStore', () => {
  it('returns undefined before the first save', () => {
    expect(store.load()).toBeUndefined();
  });

  it('stores and loads the radar document as gzip', () => {
    store.save(doc('2026-10-28T13:40:00.000Z'), 1_000);
    const loaded = store.load();
    expect(loaded?.version).toBe('2026-10-28T13:40:00.000Z');
    expect(JSON.parse(gunzipSync(loaded!.bodyGzip).toString('utf8'))).toEqual(
      doc('2026-10-28T13:40:00.000Z'),
    );
  });

  it('keeps only the latest document', () => {
    store.save(doc('2026-10-28T13:40:00.000Z'), 1_000);
    store.save(doc('2026-10-28T13:45:00.000Z'), 2_000);
    expect(store.load()?.version).toBe('2026-10-28T13:45:00.000Z');
    expect(db.prepare('SELECT count(*) AS n FROM radar_document').get()).toEqual({ n: 1 });
  });

  it('keeps the stored document when a later save is never made', () => {
    store.save(doc('2026-10-28T13:40:00.000Z'), 1_000);
    expect(store.load()?.version).toBe('2026-10-28T13:40:00.000Z');
  });

  it('survives reopening the database', () => {
    store.save(doc('2026-10-28T13:40:00.000Z'), 1_000);
    expect(createRadarStore(db).load()?.version).toBe('2026-10-28T13:40:00.000Z');
  });
});
