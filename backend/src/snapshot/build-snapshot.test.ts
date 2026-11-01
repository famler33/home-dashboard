import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { Value } from '@sinclair/typebox/value';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSnapshotStore, type SnapshotStore } from '../cache/snapshot-store.js';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import type { Source } from '../sources/source.js';
import { buildSnapshot } from './build-snapshot.js';
import { snapshotSchema } from './schema.js';

const settings = {
  timezone: 'Europe/Berlin',
  display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
};

function source(id: string, staleAfterSeconds = 120): Source {
  return { id, intervalSeconds: 60, staleAfterSeconds, timeoutMs: 1_000, fetch: async () => null };
}

let store: SnapshotStore;

beforeEach(() => {
  const db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  store = createSnapshotStore(db);
});

const now = Date.parse('2026-10-28T10:15:00.000Z');

// Covers: FR-6, FR-7, AC-22, AC-23, AC-25
describe('buildSnapshot', () => {
  it('reports never-loaded sources without data or times', () => {
    const snapshot = buildSnapshot({
      sources: [source('demo')],
      store,
      settings,
      buildId: 'b1',
      now,
    });
    expect(snapshot.sources).toEqual([
      {
        id: 'demo',
        status: 'never-loaded',
        data: null,
        lastUpdated: null,
        ageSeconds: null,
        staleAfterSeconds: 120,
        lastErrorCode: null,
      },
    ]);
  });

  it('computes ageSeconds from the injected server time', () => {
    store.recordSuccess('demo', { value: 42 }, now - 30_500);
    const [entry] = buildSnapshot({
      sources: [source('demo')],
      store,
      settings,
      buildId: 'b1',
      now,
    }).sources;
    expect(entry).toMatchObject({
      status: 'fresh',
      data: { value: 42 },
      ageSeconds: 30,
      lastUpdated: '2026-10-28T10:14:29.500Z',
    });
  });

  it('keeps data and flags stale after the threshold with a failing refresh', () => {
    store.recordSuccess('demo', { value: 1 }, now - 300_000);
    store.recordFailure('demo', 'SOURCE_TIMEOUT', now - 1_000);
    const [entry] = buildSnapshot({
      sources: [source('demo')],
      store,
      settings,
      buildId: 'b1',
      now,
    }).sources;
    expect(entry).toMatchObject({
      status: 'stale',
      data: { value: 1 },
      lastErrorCode: 'SOURCE_TIMEOUT',
    });
  });

  it('reports error when the first fetch failed', () => {
    store.recordFailure('demo', 'SOURCE_FETCH_FAILED', now);
    const [entry] = buildSnapshot({
      sources: [source('demo')],
      store,
      settings,
      buildId: 'b1',
      now,
    }).sources;
    expect(entry).toMatchObject({
      status: 'error',
      data: null,
      lastErrorCode: 'SOURCE_FETCH_FAILED',
    });
  });

  it('returns fresh for the healthy source and error for the failing one', () => {
    store.recordSuccess('good', 1, now);
    store.recordFailure('bad', 'SOURCE_FETCH_FAILED', now);
    const snapshot = buildSnapshot({
      sources: [source('good'), source('bad')],
      store,
      settings,
      buildId: 'b1',
      now,
    });
    expect(Object.fromEntries(snapshot.sources.map((entry) => [entry.id, entry.status]))).toEqual({
      bad: 'error',
      good: 'fresh',
    });
  });

  it('orders sources by id', () => {
    const snapshot = buildSnapshot({
      sources: [source('b'), source('a')],
      store,
      settings,
      buildId: 'b1',
      now,
    });
    expect(snapshot.sources.map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

// Covers: AC-22 (contract)
describe('snapshot contract', () => {
  it('matches the golden fixture and the response schema', () => {
    const fixture = JSON.parse(
      readFileSync(new URL('../../test/fixtures/snapshot.sample.json', import.meta.url), 'utf8'),
    );
    store.recordSuccess('demo', { value: 42 }, Date.parse('2026-10-28T10:14:30.000Z'));
    const snapshot = buildSnapshot({
      sources: [source('demo')],
      store,
      settings,
      buildId: '3f9c2ab',
      now,
    });
    expect(Value.Check(snapshotSchema, fixture)).toBe(true);
    expect(Value.Check(snapshotSchema, snapshot)).toBe(true);
    expect(snapshot).toEqual(fixture);
  });
});
