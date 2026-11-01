import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackupJob } from '../src/backup/backup-job.js';
import { createSnapshotStore } from '../src/cache/snapshot-store.js';
import { openDatabase } from '../src/db/database.js';
import { createListsService } from '../src/lists/lists-service.js';

let dir: string;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dashboard-lists-backup-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function service(db: Database.Database) {
  return createListsService({
    db,
    store: createSnapshotStore(db),
    now: () => Date.parse('2026-10-28T10:00:00Z'),
    timezone: 'Europe/Berlin',
  });
}

// Covers: FR-8, NFR-7, AC-3, AC-4 (lists in the nightly backup and after a restore)
describe('lists in backups', () => {
  it('contains the lists in the nightly backup copy and serves them after a restore with a new epoch', async () => {
    const db = openDatabase(join(dir, 'dashboard.sqlite'));
    const first = service(db);
    first.addItem({ id: crypto.randomUUID(), list: 'shopping', title: 'Milch' });
    first.addItem({ id: crypto.randomUUID(), list: 'todo', title: 'Regal', categoryId: 'balkon' });
    const before = first.state();

    await createBackupJob({
      db,
      dir: join(dir, 'backup'),
      retention: 3,
      clock: { now: () => Date.parse('2026-10-28T02:00:00Z') },
      logger,
    })();
    db.close();

    const file = readdirSync(join(dir, 'backup')).find((name) => name.endsWith('.sqlite'))!;
    const raw = new Database(join(dir, 'backup', file), { readonly: true });
    expect(raw.prepare("SELECT title FROM list_items WHERE list = 'shopping'").all()).toEqual([
      { title: 'Milch' },
    ]);
    raw.close();

    copyFileSync(join(dir, 'backup', file), join(dir, 'restored.sqlite'));
    const restored = openDatabase(join(dir, 'restored.sqlite'));
    const after = service(restored).state();
    expect(after.shopping.map((item) => item.title)).toEqual(['Milch']);
    expect(after.todos.map((item) => item.title)).toEqual(['Regal']);
    expect(after.rev).toBe(before.rev);
    expect(after.epoch).not.toBe(before.epoch);
    restored.close();
  });
});
