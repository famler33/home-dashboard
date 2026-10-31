import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createSnapshotStore, type SnapshotStore } from './cache/snapshot-store.js';
import { migrationsDir } from './db/database.js';
import { runMigrations } from './db/migrate.js';
import { redactPaths } from './logging.js';
import type { Source } from './sources/source.js';
import { testConfig } from '../test/helpers/test-config.js';

let tmp: string;
let store: SnapshotStore;
let app: FastifyInstance | undefined;
const logLines: string[] = [];
const logStream = new Writable({
  write(chunk, _encoding, callback) {
    logLines.push(String(chunk));
    callback();
  },
});

const demo: Source = {
  id: 'demo',
  intervalSeconds: 60,
  staleAfterSeconds: 120,
  timeoutMs: 1_000,
  fetch: async () => ({ value: 1 }),
};

function memoryStore(): SnapshotStore {
  const db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  return createSnapshotStore(db);
}

async function build(
  overrides: Partial<Parameters<typeof buildApp>[0]> = {},
): Promise<FastifyInstance> {
  app = await buildApp({
    config: testConfig(),
    store,
    clock: { now: () => Date.parse('2026-10-28T10:15:00.000Z') },
    sources: [demo],
    buildId: 'build-1',
    logger: { level: 'info', stream: logStream },
    ...overrides,
  });
  return app;
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'dashboard-app-'));
  store = memoryStore();
  logLines.length = 0;
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  rmSync(tmp, { recursive: true, force: true });
});

// Covers: FR-20, NFR-5, AC-34, AC-35
describe('GET /api/v1/health', () => {
  it('returns 200 {status:ok} when the database responds', async () => {
    const response = await (await build()).inject('/api/v1/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('returns exactly one key named status', async () => {
    const response = await (await build()).inject('/api/v1/health');
    expect(Object.keys(response.json())).toEqual(['status']);
  });

  it('returns 503 {status:error} when the database check fails', async () => {
    const response = await (
      await build({ store: { ...store, ping: () => false } })
    ).inject('/api/v1/health');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'error' });
  });

  it('does not echo exception messages when the check throws', async () => {
    const throwing = {
      ...store,
      ping: () => {
        throw new Error('SECRET-LEAK at /data/dashboard.sqlite');
      },
    };
    const response = await (await build({ store: throwing })).inject('/api/v1/health');
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('SECRET-LEAK');
  });

  it('does not write request log lines for health probes', async () => {
    const instance = await build();
    await instance.inject('/api/v1/health');
    await instance.inject('/api/v1/snapshot');
    const joined = logLines.join('');
    expect(joined).not.toContain('/api/v1/health');
    expect(joined).toContain('/api/v1/snapshot');
  });

  it('adds no version or server headers and sets no-store', async () => {
    const response = await (await build()).inject('/api/v1/health');
    expect(response.headers['server']).toBeUndefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

// Covers: FR-9, NFR-5, AC-32, AC-43
describe('security and transport', () => {
  it('sends CSP, nosniff and no-referrer and registers no CORS headers', async () => {
    const response = await (
      await build()
    ).inject({
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers the API only for allowed host names and any port', async () => {
    const instance = await build();
    for (const host of ['localhost', 'localhost:8080', '127.0.0.1:18080']) {
      const response = await instance.inject({ url: '/api/v1/health', headers: { host } });
      expect(response.statusCode, host).toBe(200);
    }
    for (const host of ['dashboard.home', '192.168.1.20:8080', 'nas.local']) {
      const response = await instance.inject({ url: '/api/v1/health', headers: { host } });
      expect(response.statusCode, host).toBe(403);
    }
  });

  it('registers no route that writes configuration and no mutating route outside the lists API', async () => {
    const instance = await build();
    const routes = instance.printRoutes({ commonPrefix: false });
    for (const line of routes.split('\n')) {
      if (/POST|PUT|PATCH|DELETE/.test(line)) expect(line).toMatch(/lists/);
    }
    expect(routes).not.toMatch(/config|settings|credentials/);
  });
});

// Covers: NFR-5 (error shape), FR-9
describe('error envelope', () => {
  it('answers unknown API routes with the JSON error envelope', async () => {
    const response = await (await build()).inject('/api/v1/nope');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), details: null },
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rejects oversized bodies with PAYLOAD_TOO_LARGE', async () => {
    const response = await (
      await build()
    ).inject({
      method: 'POST',
      url: '/api/v1/nope',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ filler: 'x'.repeat(70_000) }),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('maps unexpected errors to INTERNAL_ERROR without leaking details', async () => {
    const exploding = {
      ...store,
      get: () => {
        throw new Error('SECRET-LEAK stack detail');
      },
    };
    const response = await (await build({ store: exploding })).inject('/api/v1/snapshot');
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('INTERNAL_ERROR');
    expect(response.body).not.toContain('SECRET-LEAK');
    expect(response.body).not.toContain('stack');
  });
});

// Covers: FR-8, AC-14, AC-15, AC-22, AC-26
describe('GET /api/v1/snapshot', () => {
  it('reports the BUILD_ID value and the projected settings', async () => {
    const response = await (await build()).inject('/api/v1/snapshot');
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.buildId).toBe('build-1');
    expect(body.serverTime).toBe('2026-10-28T10:15:00.000Z');
    expect(body.settings).toEqual({
      timezone: 'Europe/Berlin',
      display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('serves cached data from the previous run immediately after startup', async () => {
    store.recordSuccess('demo', { value: 42 }, Date.parse('2026-10-28T10:14:30.000Z'));
    const body = (await (await build()).inject('/api/v1/snapshot')).json();
    expect(body.sources[0]).toMatchObject({
      id: 'demo',
      status: 'fresh',
      data: { value: 42 },
      ageSeconds: 30,
    });
  });

  it('lists no sources that are not registered', async () => {
    const body = (await (await build({ sources: [] })).inject('/api/v1/snapshot')).json();
    expect(body.sources).toEqual([]);
  });
});

// Covers: NFR-5, AC-27
describe('credential protection', () => {
  const config = () => testConfig({ credentials: { weather: { apiKey: 'S3CR3T-TEST' } } });

  it('never includes credential values or location in any API response', async () => {
    const instance = await build({ config: config() });
    const paths = ['/api/v1/health', '/api/v1/snapshot', '/api/v1/nope', '/'];
    for (const url of paths) {
      const response = await instance.inject(url);
      expect(response.body).not.toContain('S3CR3T-TEST');
      expect(response.body).not.toContain('52.52');
      expect(JSON.stringify(response.headers)).not.toContain('S3CR3T-TEST');
    }
  });

  it('never writes credential values to logs', async () => {
    const instance = await build({ config: config() });
    await instance.inject('/api/v1/snapshot');
    await instance.inject('/api/v1/nope');
    expect(logLines.join('')).not.toContain('S3CR3T-TEST');
  });

  it('redacts authorization, cookie and credential-like paths', async () => {
    expect(redactPaths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        '*.credentials',
        '*.password',
        '*.token',
        '*.apiKey',
      ]),
    );
    const instance = await build();
    await instance.inject({
      url: '/api/v1/health',
      headers: { authorization: 'Bearer S3CR3T-TEST', cookie: 'sid=S3CR3T-TEST' },
    });
    expect(logLines.join('')).not.toContain('S3CR3T-TEST');
  });
});

// Covers: FR-12, AC-15, NFR-5
describe('static delivery', () => {
  function staticDir(): string {
    const dir = join(tmp, 'static');
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Dashboard</title>');
    writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
    writeFileSync(join(dir, 'manifest.webmanifest'), '{}');
    return dir;
  }

  it('serves index.html with no-cache', async () => {
    const response = await (await build({ staticDir: staticDir() })).inject('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Dashboard');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('serves hashed assets as immutable', async () => {
    const response = await (
      await build({ staticDir: staticDir() })
    ).inject('/assets/app-abc123.js');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('serves the manifest with no-cache', async () => {
    const response = await (
      await build({ staticDir: staticDir() })
    ).inject('/manifest.webmanifest');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('falls back to index.html for unknown non-API GET paths', async () => {
    const response = await (await build({ staticDir: staticDir() })).inject('/some/client/route');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Dashboard');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('serves the single page app for the list page address with no-cache', async () => {
    const response = await (await build({ staticDir: staticDir() })).inject('/listen');
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Dashboard');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('keeps the JSON 404 for unknown API paths when static files are served', async () => {
    const response = await (await build({ staticDir: staticDir() })).inject('/api/v1/nope');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('answers non-GET requests on unknown non-API paths with the 404 envelope', async () => {
    const response = await (
      await build({ staticDir: staticDir() })
    ).inject({ method: 'POST', url: '/x' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});
