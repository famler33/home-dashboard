import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../db/migrate.js';
import { migrationsDir } from '../db/database.js';
import { createSnapshotStore, type SnapshotStore } from './snapshot-store.js';

let db: Database.Database;
let store: SnapshotStore;

beforeEach(() => {
  db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  store = createSnapshotStore(db);
});

// Covers: FR-8, AC-22, AC-23
describe('SnapshotStore', () => {
  it('returns undefined for an unknown source', () => {
    expect(store.get('nope')).toBeUndefined();
  });

  it('stores a successful payload with its timestamps', () => {
    store.recordSuccess('demo', { value: 1 }, 5_000);
    expect(store.get('demo')).toEqual({
      sourceId: 'demo',
      payload: { value: 1 },
      lastSuccessAt: 5_000,
      lastAttemptAt: 5_000,
      lastErrorCode: null,
      consecutiveFailures: 0,
    });
  });

  it('keeps payload and lastSuccessAt when a refresh fails', () => {
    store.recordSuccess('demo', { value: 1 }, 5_000);
    store.recordFailure('demo', 'SOURCE_FETCH_FAILED', 9_000);
    store.recordFailure('demo', 'SOURCE_TIMEOUT', 12_000);
    expect(store.get('demo')).toEqual({
      sourceId: 'demo',
      payload: { value: 1 },
      lastSuccessAt: 5_000,
      lastAttemptAt: 12_000,
      lastErrorCode: 'SOURCE_TIMEOUT',
      consecutiveFailures: 2,
    });
  });

  it('records a failure for a source that never succeeded', () => {
    store.recordFailure('demo', 'SOURCE_FETCH_FAILED', 1_000);
    expect(store.get('demo')).toMatchObject({
      payload: null,
      lastSuccessAt: null,
      lastErrorCode: 'SOURCE_FETCH_FAILED',
      consecutiveFailures: 1,
    });
  });

  it('clears the error and resets the failure counter on success', () => {
    store.recordFailure('demo', 'SOURCE_FETCH_FAILED', 1_000);
    store.recordSuccess('demo', { value: 2 }, 2_000);
    expect(store.get('demo')).toMatchObject({ lastErrorCode: null, consecutiveFailures: 0 });
  });

  it('keeps sources independent', () => {
    store.recordSuccess('a', 1, 1_000);
    store.recordFailure('b', 'SOURCE_TIMEOUT', 1_000);
    expect(store.get('a')?.lastErrorCode).toBeNull();
    expect(store.get('b')?.lastErrorCode).toBe('SOURCE_TIMEOUT');
  });

  it('treats an unserialisable payload as a failure', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(() => store.recordSuccess('demo', circular, 1_000)).toThrow();
  });

  it('answers ping while the database is open', () => {
    expect(store.ping()).toBe(true);
    db.close();
    expect(store.ping()).toBe(false);
  });
});
