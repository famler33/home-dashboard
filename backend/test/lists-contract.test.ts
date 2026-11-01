import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { createSnapshotStore } from '../src/cache/snapshot-store.js';
import { migrationsDir } from '../src/db/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { createListsService } from '../src/lists/lists-service.js';
import { createListsSource } from '../src/lists/lists-source.js';
import { buildSnapshot } from '../src/snapshot/build-snapshot.js';
import { snapshotSchema } from '../src/snapshot/schema.js';

const path = (name: string) => fileURLToPath(new URL(`./fixtures/lists/${name}`, import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(path(name), 'utf8')) as unknown;

// Covers: FR-1, FR-8, NFR-7, AC-43 (contract with the frontend)
describe('lists contract', () => {
  it('builds the golden state and snapshot from a fixed scenario', () => {
    const db = new Database(':memory:');
    runMigrations(db, migrationsDir);
    const store = createSnapshotStore(db);
    let now = Date.parse('2026-10-28T10:00:00Z');
    const service = createListsService({
      db,
      store,
      now: () => now,
      timezone: 'Europe/Berlin',
      epoch: 'sample-epoch',
    });
    const ids = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
    const add = (input: Parameters<typeof service.addItem>[0]) => {
      now += 60_000;
      service.addItem(input);
    };
    add({ id: ids(1), list: 'shopping', title: 'Milch' });
    add({ id: ids(2), list: 'shopping', title: 'Brot' });
    add({
      id: ids(3),
      list: 'todo',
      title: 'Verkabelung Schreibtisch',
      categoryId: 'buero',
      priority: 'high',
      effortHours: 1,
    });
    add({
      id: ids(4),
      list: 'todo',
      title: 'Lichtsituation planen',
      categoryId: 'wohnzimmer',
      priority: 'medium',
      effortHours: 2,
      prerequisite: 'Lampen kaufen',
    });
    add({
      id: ids(5),
      list: 'todo',
      title: 'Pflanze leiten',
      categoryId: 'kueche',
      priority: 'low',
    });
    now += 60_000;
    service.patchItem(ids(2), { checked: true });
    now += 60_000;
    service.deleteItem(ids(1));
    service.addItem({ id: ids(6), list: 'shopping', title: 'Eier' });

    const state = service.state();
    const snapshot = buildSnapshot({
      sources: [createListsSource(service, () => now)],
      store,
      settings: {
        timezone: 'Europe/Berlin',
        display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
      },
      buildId: 'sample',
      now,
    });
    expect(Value.Check(snapshotSchema, snapshot)).toBe(true);

    if (process.env['UPDATE_FIXTURES'] === '1') {
      writeFileSync(path('lists.state.sample.json'), `${JSON.stringify(state)}\n`);
      writeFileSync(path('lists.snapshot.sample.json'), `${JSON.stringify(snapshot)}\n`);
    }
    expect(state).toEqual(read('lists.state.sample.json'));
    expect(snapshot).toEqual(read('lists.snapshot.sample.json'));
  });
});
