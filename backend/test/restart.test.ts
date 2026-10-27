import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSnapshotStore } from '../src/cache/snapshot-store.js';
import { openDatabase } from '../src/db/database.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dashboard-restart-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Covers: FR-8, AC-24
describe('persistence across restarts', () => {
  it('serves cached payloads after closing and reopening the database', () => {
    const path = join(dir, 'dashboard.sqlite');
    const first = openDatabase(path);
    createSnapshotStore(first).recordSuccess('demo', { value: 42 }, 7_000);
    first.close();

    const second = openDatabase(path);
    expect(createSnapshotStore(second).get('demo')).toMatchObject({
      payload: { value: 42 },
      lastSuccessAt: 7_000,
    });
    second.close();
  });
});
