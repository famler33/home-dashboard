import { chmodSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { Clock } from '../clock.js';
import type { Logger } from '../logger.js';
import type { Scheduler } from '../scheduler/scheduler.js';

const BACKUP_NAME = /^dashboard-\d{8}-\d{6}\.sqlite$/;

function fileName(now: number): string {
  const iso = new Date(now).toISOString(); // 2026-10-28T03:00:00.000Z
  const date = iso.slice(0, 10).replaceAll('-', '');
  const time = iso.slice(11, 19).replaceAll(':', '');
  return `dashboard-${date}-${time}.sqlite`;
}

function ensureDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    chmodSync(dir, 0o700);
  } catch {
    // A bind mount owned by another user keeps its own mode; the runbook documents it.
  }
}

function prune(dir: string, retention: number): number {
  const backups = readdirSync(dir)
    .filter((name) => BACKUP_NAME.test(name))
    .sort();
  const surplus = backups.slice(0, Math.max(0, backups.length - retention));
  for (const name of surplus) rmSync(join(dir, name), { force: true });
  return surplus.length;
}

export function createBackupJob(deps: {
  db: Database.Database;
  dir: string;
  retention: number;
  clock: Clock;
  logger: Logger;
}): () => Promise<void> {
  const { db, dir, retention, clock, logger } = deps;

  return async () => {
    try {
      ensureDirectory(dir);
      const name = fileName(clock.now());
      const temporary = join(dir, `${name}.tmp`);
      try {
        await db.backup(temporary);
        renameSync(temporary, join(dir, name));
      } catch (error) {
        rmSync(temporary, { force: true });
        throw error;
      }
      const pruned = prune(dir, retention);
      logger.info({ file: name, bytes: statSync(join(dir, name)).size, pruned }, 'backup written');
    } catch (error) {
      logger.error(
        { errorClass: error instanceof Error ? error.name : 'unknown' },
        'backup failed',
      );
    }
  };
}

export function registerBackup(
  scheduler: Scheduler,
  job: () => Promise<void>,
  backup: { time: string; retention: number },
  timeZone: string,
): void {
  scheduler.dailyAt('backup', backup.time, timeZone, job);
}
