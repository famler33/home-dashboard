import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tinyPng } from '../../test/helpers/png.js';
import { testConfig } from '../../test/helpers/test-config.js';
import { buildApp } from '../app.js';
import { createSnapshotStore } from '../cache/snapshot-store.js';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { createBasemapService } from '../sources/weather/basemap.js';
import { createRadarStore, type RadarStore } from '../sources/weather/radar-store.js';
import type { RadarDocument } from '../sources/weather/types.js';

const doc: RadarDocument = {
  version: '2026-10-28T13:40:00.000Z',
  size: 101,
  corners: [
    [12.7, 52.9],
    [12.6, 52.1],
    [14.0, 52.0],
    [14.1, 52.9],
  ],
  home: { col: 50, row: 50, lat: 52.52, lon: 13.4 },
  map: { zoom: 9, tileSize: 256, tiles: [{ x: 274, y: 168 }] },
  frames: [{ time: '2026-10-28T13:40:00.000Z', kind: 'observed', values: 'AAAA' }],
};

let tmp: string;
let radarStore: RadarStore;
let app: FastifyInstance | undefined;
let tileFetch: ReturnType<typeof vi.fn>;

async function build(): Promise<FastifyInstance> {
  const db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  radarStore = createRadarStore(db);
  tileFetch = vi.fn(
    async () => new Response(tinyPng, { headers: { 'content-type': 'image/png' } }),
  );
  const basemap = createBasemapService({
    dir: tmp,
    fetchImpl: tileFetch as unknown as typeof fetch,
    userAgent: 'home-dashboard/test',
  });
  basemap.setAllowed([{ z: 9, x: 274, y: 168 }]);
  app = await buildApp({
    config: testConfig(),
    store: createSnapshotStore(db),
    clock: { now: () => Date.parse('2026-10-28T13:50:00Z') },
    sources: [],
    buildId: 'build-1',
    weather: { radarStore, basemap },
    logger: { level: 'silent' },
  });
  return app;
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'dashboard-weather-route-'));
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(tmp, { recursive: true, force: true });
});

// Covers: FR-8, NFR-4, AC-16, AC-18, AC-19, AC-21
describe('GET /api/v1/weather/radar', () => {
  it('answers RADAR_NOT_AVAILABLE before the first refresh and is not cacheable', async () => {
    const response = await (await build()).inject('/api/v1/weather/radar');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('RADAR_NOT_AVAILABLE');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('serves the radar document gzip-encoded with an ETag and revalidation', async () => {
    const instance = await build();
    radarStore.save(doc, 1_000);
    const response = await instance.inject('/api/v1/weather/radar');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(response.headers['etag']).toBe(`"${doc.version}"`);
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(JSON.parse(gunzipSync(response.rawPayload).toString('utf8'))).toEqual(doc);
  });

  it('answers 304 without a body when the version is unchanged', async () => {
    const instance = await build();
    radarStore.save(doc, 1_000);
    const response = await instance.inject({
      url: '/api/v1/weather/radar',
      headers: { 'if-none-match': `"${doc.version}"` },
    });
    expect(response.statusCode).toBe(304);
    expect(response.rawPayload).toHaveLength(0);
  });

  it('serves the new document after a newer save', async () => {
    const instance = await build();
    radarStore.save(doc, 1_000);
    radarStore.save({ ...doc, version: '2026-10-28T13:45:00.000Z' }, 2_000);
    const response = await instance.inject({
      url: '/api/v1/weather/radar',
      headers: { 'if-none-match': `"${doc.version}"` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['etag']).toBe('"2026-10-28T13:45:00.000Z"');
  });
});

describe('GET /api/v1/weather/basemap/:z/:x/:y', () => {
  it('serves an allowed tile as a cacheable PNG', async () => {
    const response = await (await build()).inject('/api/v1/weather/basemap/9/274/168');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['cache-control']).toBe('private, max-age=86400');
    expect(response.rawPayload.equals(tinyPng)).toBe(true);
  });

  it('answers 404 for tiles outside the allow-list without echoing the input or calling upstream', async () => {
    const response = await (await build()).inject('/api/v1/weather/basemap/9/999/999');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    expect(response.body).not.toContain('999');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(tileFetch).not.toHaveBeenCalled();
  });

  it.each([
    '/api/v1/weather/basemap/9/..%2F..%2Fetc/1',
    '/api/v1/weather/basemap/9/274/168.png',
    '/api/v1/weather/basemap/9/1e3/1',
  ])('rejects the malformed path %s without echoing it', async (url) => {
    const response = await (await build()).inject(url);
    expect([400, 404]).toContain(response.statusCode);
    expect(response.body).not.toContain('etc');
    expect(tileFetch).not.toHaveBeenCalled();
  });

  it('answers 502 UPSTREAM_UNAVAILABLE when an uncached tile cannot be fetched', async () => {
    const instance = await build();
    tileFetch.mockRejectedValueOnce(new TypeError('network SECRET-LEAK'));
    const response = await instance.inject('/api/v1/weather/basemap/9/274/168');
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(response.body).not.toContain('SECRET-LEAK');
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('cache headers across the API', () => {
  it('keeps no-store on every API route except the two cacheable ones', async () => {
    const instance = await build();
    radarStore.save(doc, 1_000);
    const routes: [string, boolean][] = [
      ['/api/v1/health', false],
      ['/api/v1/snapshot', false],
      ['/api/v1/nope', false],
      ['/api/v1/weather/radar', true],
      ['/api/v1/weather/basemap/9/274/168', true],
    ];
    for (const [url, cacheable] of routes) {
      const header = (await instance.inject(url)).headers['cache-control'];
      expect(header === 'no-store', `${url} -> ${header}`).toBe(!cacheable);
    }
  });

  it('registers no weather routes when the weather dependencies are absent', async () => {
    const db = new Database(':memory:');
    runMigrations(db, migrationsDir);
    app = await buildApp({
      config: testConfig(),
      store: createSnapshotStore(db),
      clock: { now: () => 0 },
      sources: [],
      buildId: 'b',
      logger: { level: 'silent' },
    });
    expect((await app.inject('/api/v1/weather/radar')).statusCode).toBe(404);
  });
});
