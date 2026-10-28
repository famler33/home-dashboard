import { calendarIds } from './config/schema.js';
import type { Logger } from './logger.js';
import { createCalendarSource } from './sources/calendar/calendar-source.js';
import { createFeedTransport, type FeedTransport } from './sources/calendar/feed-transport.js';
import { normaliseFeedUrl } from './sources/calendar/feed-url.js';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
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
import { createAlertsSource } from './sources/weather/alerts-source.js';
import { createBasemapService } from './sources/weather/basemap.js';
import { createWeatherSource } from './sources/weather/open-meteo-source.js';
import { createRadarSource } from './sources/weather/radar-source.js';
import { createRadarStore, type RadarStore } from './sources/weather/radar-store.js';
import type { RadarDocument } from './sources/weather/types.js';
import type { Source } from './sources/source.js';

export interface RunningServer {
  url: string;
  stop(): Promise<void>;
}

export interface ServerOverrides {
  fetchImpl?: typeof fetch;
  now?: () => number;
  calendarTransport?: FeedTransport;
}

function tilesOf(body: Buffer): { z: number; x: number; y: number }[] {
  const doc = JSON.parse(gunzipSync(body).toString('utf8')) as RadarDocument;
  return doc.map.tiles.map((tile) => ({ z: doc.map.zoom, ...tile }));
}

export async function startServer(
  env: NodeJS.ProcessEnv,
  overrides: ServerOverrides = {},
): Promise<RunningServer> {
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

  let weather:
    { radarStore: RadarStore; basemap: ReturnType<typeof createBasemapService> } | undefined;
  if (config.settings.sources.weather?.enabled !== false) {
    const fetchImpl = overrides.fetchImpl ?? fetch;
    const userAgent = `home-dashboard/${buildId}`;
    const baseStore = createRadarStore(db);
    const basemap = createBasemapService({ dir: join(dataDir, 'tiles'), fetchImpl, userAgent });
    const stored = baseStore.load();
    if (stored) basemap.setAllowed(tilesOf(stored.bodyGzip));
    const radarStore: RadarStore = {
      load: () => baseStore.load(),
      save(doc, now) {
        baseStore.save(doc, now);
        basemap.setAllowed(doc.map.tiles.map((tile) => ({ z: doc.map.zoom, ...tile })));
      },
    };
    const { location, timezone } = {
      location: config.settings.location,
      timezone: config.settings.timezone,
    };
    const now = overrides.now;
    const nowOption = now ? { now } : {};
    sources.push(
      createWeatherSource({ location, timezone, fetchImpl, userAgent, ...nowOption }),
      createRadarSource({ location, fetchImpl, userAgent, radarStore, ...nowOption }),
      createAlertsSource({ location, fetchImpl, userAgent, ...nowOption }),
    );
    weather = { radarStore, basemap };
  }

  const loggerRef: { current?: Logger } = {};
  const calendar = config.settings.sources.calendar;
  if (calendar?.enabled) {
    const transport = overrides.calendarTransport ?? createFeedTransport();
    const userAgent = `home-dashboard/${buildId}`;
    const lazyLogger = { warn: (obj: object, msg?: string) => loggerRef.current?.warn(obj, msg) };
    for (const id of calendarIds) {
      const entry = calendar.calendars[id];
      if (!entry.enabled) continue;
      sources.push(
        createCalendarSource({
          id: `calendar-${id}`,
          url: normaliseFeedUrl(config.credentials[`calendar-${id}`]?.['url'] ?? ''),
          timezone: config.settings.timezone,
          selfAddresses: entry.selfAddresses ?? [],
          transport,
          userAgent,
          ...(overrides.now ? { now: () => new Date(overrides.now!()) } : {}),
          logger: lazyLogger,
        }),
      );
    }
  }

  const app = await buildApp({
    config,
    store,
    clock: systemClock,
    sources,
    buildId,
    ...(staticDir !== undefined ? { staticDir } : {}),
    ...(weather ? { weather } : {}),
  });
  loggerRef.current = app.log;
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
