import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { createFakeTime } from '../../test/helpers/fake-time.js';
import { createSnapshotStore } from '../cache/snapshot-store.js';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { createScheduler } from '../scheduler/scheduler.js';
import { registerSources } from './register-sources.js';
import { createSourceRunner } from './source-runner.js';
import type { Source } from './source.js';

// Covers: NFR-1, NFR-2, AC-16
describe('long run', () => {
  it('keeps refreshing sources for 10000 simulated intervals without growth', async () => {
    const time = createFakeTime();
    const db = new Database(':memory:');
    runMigrations(db, migrationsDir);
    const store = createSnapshotStore(db);
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const scheduler = createScheduler({ clock: time, timers: time, logger });
    let calls = 0;
    const source: Source = {
      id: 'demo',
      intervalSeconds: 60,
      staleAfterSeconds: 120,
      timeoutMs: 1_000,
      fetch: async () => {
        calls += 1;
        return { value: calls };
      },
    };
    registerSources(scheduler, createSourceRunner({ store, clock: time, logger }), [source]);

    await time.advance(0);
    expect(time.pendingCount()).toBe(1);
    for (let batch = 0; batch < 100; batch += 1) {
      await time.advance(100 * 60_000);
      expect(time.pendingCount()).toBe(1);
    }

    expect(calls).toBe(10_001);
    expect(db.prepare('SELECT count(*) AS n FROM source_state').get()).toEqual({ n: 1 });
    expect(store.get('demo')).toMatchObject({ payload: { value: 10_001 }, consecutiveFailures: 0 });
    await scheduler.stop();
  });
});
