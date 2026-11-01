import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSnapshotStore, type SnapshotStore } from '../cache/snapshot-store.js';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { createSourceRunner } from './source-runner.js';
import type { Source } from './source.js';

let store: SnapshotStore;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const clock = { now: () => 10_000 };

function source(fetch: Source['fetch'], timeoutMs = 1_000): Source {
  return { id: 'demo', intervalSeconds: 60, staleAfterSeconds: 120, timeoutMs, fetch };
}

beforeEach(() => {
  const db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  store = createSnapshotStore(db);
  logger.info.mockClear();
  logger.warn.mockClear();
  logger.error.mockClear();
});

// Covers: FR-8, FR-10, NFR-3, AC-22, AC-23, AC-25
describe('SourceRunner', () => {
  it('records a successful fetch', async () => {
    const runner = createSourceRunner({ store, clock, logger });
    await runner.refresh(source(async () => ({ value: 1 })));
    expect(store.get('demo')).toMatchObject({ payload: { value: 1 }, lastSuccessAt: 10_000 });
  });

  it('keeps the previous result when a refresh fails', async () => {
    const runner = createSourceRunner({ store, clock, logger });
    await runner.refresh(source(async () => ({ value: 1 })));
    await runner.refresh(
      source(async () => {
        throw new Error('down');
      }),
    );
    expect(store.get('demo')).toMatchObject({
      payload: { value: 1 },
      lastErrorCode: 'SOURCE_FETCH_FAILED',
      consecutiveFailures: 1,
    });
  });

  it('maps a timeout to SOURCE_TIMEOUT even when fetch ignores the abort signal', async () => {
    const runner = createSourceRunner({ store, clock, logger });
    await runner.refresh(source(() => new Promise(() => {}), 20));
    expect(store.get('demo')).toMatchObject({ lastErrorCode: 'SOURCE_TIMEOUT' });
  });

  it('maps an abort error from fetch to SOURCE_TIMEOUT', async () => {
    const runner = createSourceRunner({ store, clock, logger });
    await runner.refresh(
      source(async () => {
        throw new DOMException('aborted', 'AbortError');
      }),
    );
    expect(store.get('demo')).toMatchObject({ lastErrorCode: 'SOURCE_TIMEOUT' });
  });

  it('records a failure for a payload that cannot be stored', async () => {
    const runner = createSourceRunner({ store, clock, logger });
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    await runner.refresh(source(async () => circular));
    expect(store.get('demo')).toMatchObject({
      payload: null,
      lastErrorCode: 'SOURCE_FETCH_FAILED',
    });
  });

  it('logs only the source id and the error code for failures', async () => {
    const runner = createSourceRunner({ store, clock, logger });
    await runner.refresh(
      source(async () => {
        throw new Error('remote said SECRET-LEAK');
      }),
    );
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logged).toContain('"sourceId":"demo"');
    expect(logged).toContain('SOURCE_FETCH_FAILED');
    expect(logged).not.toContain('SECRET-LEAK');
  });

  it('never throws, so one failing source cannot break the scheduler', async () => {
    const runner = createSourceRunner({ store, clock, logger });
    await expect(
      runner.refresh(
        source(() => {
          throw new Error('sync');
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
