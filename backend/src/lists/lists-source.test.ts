import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { createSnapshotStore } from '../cache/snapshot-store.js';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { deriveStatus } from '../snapshot/derive-status.js';
import { createSourceRunner } from '../sources/source-runner.js';
import { createListsService } from './lists-service.js';
import { createListsSource } from './lists-source.js';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function setup() {
  const db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  const store = createSnapshotStore(db);
  let now = Date.parse('2026-10-28T10:00:00Z');
  const service = createListsService({ db, store, now: () => now, timezone: 'Europe/Berlin' });
  const source = createListsSource(service, () => now);
  return { store, service, source, setNow: (value: number) => (now = value), now: () => now };
}

// Covers: FR-8, FR-9, AC-3, AC-13, AC-43 (lists source)
describe('lists source', () => {
  it('declares a 900 second interval, a 7200 second stale threshold and a 5 second timeout', () => {
    const { source } = setup();
    expect(source).toMatchObject({
      id: 'lists',
      intervalSeconds: 900,
      staleAfterSeconds: 7200,
      timeoutMs: 5000,
    });
  });

  it('returns the summary built from the database and purges expired entries first', async () => {
    const { source, service, setNow } = setup();
    const item = service.addItem({ id: crypto.randomUUID(), list: 'shopping', title: 'Milch' })
      .state.shopping[0]!;
    service.patchItem(item.id, { checked: true });
    setNow(Date.parse('2026-10-29T12:00:00Z'));
    const payload = await source.fetch(new AbortController().signal);
    expect(payload.shopping).toEqual([]);
    expect(payload.counts.shoppingOpen).toBe(0);
  });

  it('never reports the lists source as stale while the scheduler keeps running it', async () => {
    const { store, source, setNow, now } = setup();
    const runner = createSourceRunner({ store, clock: { now }, logger });
    for (let minutes = 0; minutes <= 180; minutes += 15) {
      setNow(Date.parse('2026-10-28T10:00:00Z') + minutes * 60_000);
      await runner.refresh(source);
      expect(deriveStatus(store.get('lists'), source.staleAfterSeconds, now())).toBe('fresh');
    }
  });

  it('shows fresh right after a mutation without waiting for a run', () => {
    const { store, service, now } = setup();
    service.addItem({ id: crypto.randomUUID(), list: 'shopping', title: 'Milch' });
    expect(deriveStatus(store.get('lists'), 7200, now())).toBe('fresh');
  });
});
