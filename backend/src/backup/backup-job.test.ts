import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSnapshotStore } from '../cache/snapshot-store.js';
import { openDatabase } from '../db/database.js';
import type { Scheduler } from '../scheduler/scheduler.js';
import { createBackupJob, registerBackup } from './backup-job.js';

let dir: string;
let db: Database.Database;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function clockAt(iso: string) {
  return { now: () => Date.parse(iso) };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dashboard-backup-'));
  db = openDatabase(join(dir, 'dashboard.sqlite'));
  logger.info.mockClear();
  logger.warn.mockClear();
  logger.error.mockClear();
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const backupFiles = (target: string) => readdirSync(target).sort();

// Covers: FR-23, AC-41
describe('backup job', () => {
  it('writes a consistent SQLite copy that opens and contains the rows', async () => {
    createSnapshotStore(db).recordSuccess('demo', { value: 42 }, 5_000);
    const target = join(dir, 'backup');
    const job = createBackupJob({
      db,
      dir: target,
      retention: 14,
      clock: clockAt('2026-10-28T03:00:00Z'),
      logger,
    });

    await job();

    expect(backupFiles(target)).toEqual(['dashboard-20261028-030000.sqlite']);
    const copy = new Database(join(target, 'dashboard-20261028-030000.sqlite'), { readonly: true });
    expect(copy.prepare('SELECT payload_json FROM source_state').get()).toEqual({
      payload_json: '{"value":42}',
    });
    expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
    copy.close();
  });

  it('creates the backup directory with mode 0700', async () => {
    const target = join(dir, 'backup');
    await createBackupJob({
      db,
      dir: target,
      retention: 14,
      clock: clockAt('2026-10-28T03:00:00Z'),
      logger,
    })();
    expect(statSync(target).mode & 0o777).toBe(0o700);
  });

  it('leaves no temporary files behind and only contains database copies', async () => {
    const target = join(dir, 'backup');
    await createBackupJob({
      db,
      dir: target,
      retention: 14,
      clock: clockAt('2026-10-28T03:00:00Z'),
      logger,
    })();
    expect(backupFiles(target).every((name) => /^dashboard-\d{8}-\d{6}\.sqlite$/.test(name))).toBe(
      true,
    );
  });

  it('keeps only the newest N backups', async () => {
    const target = join(dir, 'backup');
    for (const day of ['20', '21', '22', '23', '24']) {
      await createBackupJob({
        db,
        dir: target,
        retention: 3,
        clock: clockAt(`2026-10-${day}T03:00:00Z`),
        logger,
      })();
    }
    expect(backupFiles(target)).toEqual([
      'dashboard-20261022-030000.sqlite',
      'dashboard-20261023-030000.sqlite',
      'dashboard-20261024-030000.sqlite',
    ]);
  });

  it('does not delete unrelated files in the backup directory', async () => {
    const target = join(dir, 'backup');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'notes.txt'), 'keep me');
    await createBackupJob({
      db,
      dir: target,
      retention: 1,
      clock: clockAt('2026-10-28T03:00:00Z'),
      logger,
    })();
    expect(existsSync(join(target, 'notes.txt'))).toBe(true);
  });

  it('logs a failed backup and does not throw', async () => {
    const blocked = join(dir, 'blocked');
    writeFileSync(blocked, 'a file where the directory should be');
    const job = createBackupJob({
      db,
      dir: join(blocked, 'sub'),
      retention: 14,
      clock: clockAt('2026-10-28T03:00:00Z'),
      logger,
    });
    await expect(job()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('logs the result without file paths of the data directory contents', async () => {
    const target = join(dir, 'backup');
    await createBackupJob({
      db,
      dir: target,
      retention: 14,
      clock: clockAt('2026-10-28T03:00:00Z'),
      logger,
    })();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'dashboard-20261028-030000.sqlite', pruned: 0 }),
      'backup written',
    );
  });

  it('starts from a restored backup file', async () => {
    createSnapshotStore(db).recordSuccess('demo', { value: 7 }, 9_000);
    const target = join(dir, 'backup');
    await createBackupJob({
      db,
      dir: target,
      retention: 14,
      clock: clockAt('2026-10-28T03:00:00Z'),
      logger,
    })();

    const restoreDir = join(dir, 'restored');
    mkdirSync(restoreDir);
    const restoredPath = join(restoreDir, 'dashboard.sqlite');
    writeFileSync(
      restoredPath,
      (await import('node:fs')).readFileSync(join(target, 'dashboard-20261028-030000.sqlite')),
    );
    const restored = openDatabase(restoredPath);
    expect(createSnapshotStore(restored).get('demo')).toMatchObject({ payload: { value: 7 } });
    restored.close();
  });
});

describe('registerBackup', () => {
  it('schedules the job daily at backup.time in the configured timezone', () => {
    const dailyAt = vi.fn();
    const scheduler = { every: vi.fn(), dailyAt, stop: vi.fn() } as unknown as Scheduler;
    const job = vi.fn(async () => {});
    registerBackup(scheduler, job, { time: '03:00', retention: 14 }, 'Europe/Berlin');
    expect(dailyAt).toHaveBeenCalledWith('backup', '03:00', 'Europe/Berlin', job);
  });
});
