import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it, vi } from 'vitest';
import { createSnapshotStore } from '../src/cache/snapshot-store.js';
import { migrationsDir } from '../src/db/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { buildSnapshot } from '../src/snapshot/build-snapshot.js';
import { snapshotSchema } from '../src/snapshot/schema.js';
import { createAlertsSource } from '../src/sources/weather/alerts-source.js';
import { createWeatherSource } from '../src/sources/weather/open-meteo-source.js';
import { createRadarSource } from '../src/sources/weather/radar-source.js';
import {
  alertsPayloadSchema,
  radarPayloadSchema,
  weatherPayloadSchema,
} from '../src/sources/weather/types.js';
import { testConfig } from './helpers/test-config.js';

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as unknown;
const goldenPath = fileURLToPath(
  new URL('./fixtures/weather.snapshot.sample.json', import.meta.url),
);
const now = Date.parse('2026-10-28T13:50:00Z');
const signal = new AbortController().signal;
const location = testConfig().settings.location;

const respondWith = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

// Covers: FR-1, FR-6, FR-11, AC-1, AC-31 (contract with the frontend)
describe('weather snapshot contract', () => {
  it('builds the golden snapshot from the recorded provider responses and matches the schemas', async () => {
    const userAgent = 'home-dashboard/test';
    const weather = createWeatherSource({
      location,
      timezone: 'Europe/Berlin',
      fetchImpl: respondWith(read('open-meteo.sample.json')),
      userAgent,
      now: () => now,
    });
    const radar = createRadarSource({
      location,
      fetchImpl: respondWith(read('brightsky-radar.sample.json')),
      userAgent,
      radarStore: { save: () => {}, load: () => undefined },
      now: () => now,
    });
    const alerts = createAlertsSource({
      location,
      fetchImpl: respondWith(read('brightsky-alerts.sample.json')),
      userAgent,
      now: () => now,
    });

    const payloads = {
      weather: await weather.fetch(signal),
      'weather-radar': await radar.fetch(signal),
      'weather-alerts': await alerts.fetch(signal),
    };
    expect(Value.Check(weatherPayloadSchema, payloads.weather)).toBe(true);
    expect(Value.Check(radarPayloadSchema, payloads['weather-radar'])).toBe(true);
    expect(Value.Check(alertsPayloadSchema, payloads['weather-alerts'])).toBe(true);

    const db = new Database(':memory:');
    runMigrations(db, migrationsDir);
    const store = createSnapshotStore(db);
    for (const [id, payload] of Object.entries(payloads))
      store.recordSuccess(id, payload, now - 30_000);
    const snapshot = buildSnapshot({
      sources: [weather, radar, alerts],
      store,
      settings: {
        timezone: 'Europe/Berlin',
        display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
      },
      buildId: 'sample',
      now,
    });
    expect(Value.Check(snapshotSchema, snapshot)).toBe(true);

    if (process.env['UPDATE_FIXTURES'] === '1')
      writeFileSync(goldenPath, `${JSON.stringify(snapshot)}\n`);
    expect(snapshot).toEqual(read('weather.snapshot.sample.json'));
  });
});
