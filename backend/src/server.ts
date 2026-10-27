import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { buildApp } from './app.js';
import { createBackupJob, registerBackup } from './backup/backup-job.js';
import { createSnapshotStore } from './cache/snapshot-store.js';
import { systemClock } from './clock.js';
import { loadConfig } from './config/load-config.js';
import { openDatabase } from './db/database.js';
import { createScheduler } from './scheduler/scheduler.js';
import { createDemoSource } from './sources/demo-source.js';
import { registerSources } from './sources/register-sources.js';
import { createSourceRunner } from './sources/source-runner.js';
import type { Source } from './sources/source.js';

export interface RunningServer {
  url: string;
  stop(): Promise<void>;
}

export async function startServer(env: NodeJS.ProcessEnv): Promise<RunningServer> {
  const config = loadConfig(env);
  const dataDir = env['DATA_DIR'] ?? '/data';
  const backupDir = env['BACKUP_DIR'] ?? '/backup';
  const host = env['HOST'] ?? '0.0.0.0';
  const port = Number(env['PORT'] ?? 8080);
  const buildId = env['BUILD_ID'] ?? 'dev';
  const staticDir = env['STATIC_DIR'];

  const db = openDatabase(join(dataDir, 'dashboard.sqlite'));
  const store = createSnapshotStore(db);
  const sources: Source[] = config.settings.sources.demo.enabled ? [createDemoSource()] : [];

  const app = await buildApp({
    config,
    store,
    clock: systemClock,
    sources,
    buildId,
    ...(staticDir !== undefined ? { staticDir } : {}),
  });
  for (const warning of config.warnings) app.log.warn(warning);

  const scheduler = createScheduler({
    clock: systemClock,
    timers: {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
    },
    logger: app.log,
  });
  registerSources(
    scheduler,
    createSourceRunner({ store, clock: systemClock, logger: app.log }),
    sources,
  );
  registerBackup(
    scheduler,
    createBackupJob({
      db,
      dir: backupDir,
      retention: config.settings.backup.retention,
      clock: systemClock,
      logger: app.log,
    }),
    config.settings.backup,
    config.settings.timezone,
  );

  try {
    await app.listen({ host, port });
  } catch (error) {
    await scheduler.stop();
    db.close();
    throw error;
  }
  const address = app.server.address() as AddressInfo;

  return {
    url: `http://${address.address === '::' ? 'localhost' : address.address}:${address.port}`,
    async stop() {
      await scheduler.stop();
      await app.close();
      db.close();
    },
  };
}
