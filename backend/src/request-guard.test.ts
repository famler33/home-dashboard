import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { buildApp } from './app.js';
import { createSnapshotStore } from './cache/snapshot-store.js';
import { migrationsDir } from './db/database.js';
import { runMigrations } from './db/migrate.js';
import { systemClock } from './clock.js';
import { redactPaths } from './logging.js';
import { testConfig } from '../test/helpers/test-config.js';

let app: FastifyInstance | undefined;

async function start(allowedHosts?: string[]) {
  const db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  const config = testConfig();
  if (allowedHosts) config.settings.network = { allowedHosts };
  app = await buildApp({
    config,
    store: createSnapshotStore(db),
    clock: systemClock,
    sources: [],
    buildId: 'test',
  });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const call = (
  instance: FastifyInstance,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  headers: Record<string, string> = {},
) => instance.inject({ method, url, headers });

// Covers: NFR-3, AC-5, AC-40 (request guard for the lists API)
describe('request guard', () => {
  it('rejects a Host outside network.allowedHosts with 403 FORBIDDEN_HOST for GET and mutations without echoing it', async () => {
    const instance = await start(['dashboard.home']);
    for (const method of ['GET', 'POST', 'DELETE'] as const) {
      const response = await call(instance, method, '/api/v1/snapshot', { host: 'evil.example' });
      expect(response.statusCode, method).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN_HOST');
      expect(response.body).not.toContain('evil.example');
      expect(response.headers['cache-control']).toBe('no-store');
    }
  });

  it('accepts configured names with any port, case-insensitively, and the loopback names', async () => {
    const instance = await start(['dashboard.home']);
    for (const host of [
      'dashboard.home',
      'Dashboard.Home:8080',
      'localhost:8080',
      '127.0.0.1',
      '127.0.0.1:18080',
      '[::1]:8080',
    ]) {
      const response = await call(instance, 'GET', '/api/v1/health', { host });
      expect(response.statusCode, host).toBe(200);
    }
  });

  it('allows only loopback when network.allowedHosts is missing', async () => {
    const instance = await start();
    expect((await call(instance, 'GET', '/api/v1/health', { host: 'localhost' })).statusCode).toBe(
      200,
    );
    expect(
      (await call(instance, 'GET', '/api/v1/health', { host: 'dashboard.home' })).statusCode,
    ).toBe(403);
  });

  it('does not guard the single page app and its assets', async () => {
    const instance = await start(['dashboard.home']);
    const response = await call(instance, 'GET', '/listen', { host: 'evil.example' });
    expect(response.statusCode).not.toBe(403);
  });

  it('rejects a cross-origin Origin, Origin null and Sec-Fetch-Site cross-site on mutations, also without a body', async () => {
    const instance = await start(['dashboard.home']);
    const base = { host: 'dashboard.home' };
    for (const headers of [
      { ...base, origin: 'https://evil.example' },
      { ...base, origin: 'http://other.home' },
      { ...base, origin: 'null' },
      { ...base, 'sec-fetch-site': 'cross-site' },
    ]) {
      for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
        const response = await call(instance, method, '/api/v1/nope', headers);
        expect(response.statusCode, `${method} ${JSON.stringify(headers)}`).toBe(403);
      }
    }
  });

  it('accepts a matching Origin, a request without Origin and same-origin fetch metadata', async () => {
    const instance = await start(['dashboard.home']);
    for (const headers of [
      { host: 'dashboard.home:8080', origin: 'http://dashboard.home:8080' },
      { host: 'dashboard.home' },
      { host: 'dashboard.home', 'sec-fetch-site': 'same-origin' },
    ]) {
      const response = await call(instance, 'POST', '/api/v1/nope', headers);
      expect(response.statusCode).toBe(404);
    }
  });

  it('lets GET requests with a foreign Origin through the origin rule but not through the host rule', async () => {
    const instance = await start(['dashboard.home']);
    const response = await call(instance, 'GET', '/api/v1/health', {
      host: 'dashboard.home',
      origin: 'https://evil.example',
    });
    expect(response.statusCode).toBe(200);
  });

  it('answers 415 UNSUPPORTED_MEDIA_TYPE for a body that is not JSON', async () => {
    const instance = await start(['dashboard.home']);
    instance.post('/api/v1/echo', async () => ({ ok: true }));
    const response = await instance.inject({
      method: 'POST',
      url: '/api/v1/echo',
      headers: { host: 'dashboard.home', 'content-type': 'text/plain' },
      payload: 'hello',
    });
    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('sends no Access-Control headers and answers a preflight without them', async () => {
    const instance = await start(['dashboard.home']);
    const response = await instance.inject({
      method: 'OPTIONS',
      url: '/api/v1/snapshot',
      headers: {
        host: 'dashboard.home',
        origin: 'https://evil.example',
        'access-control-request-method': 'POST',
      },
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('redacts titles, names, prerequisites and bodies in log objects', () => {
    for (const path of ['*.title', '*.name', '*.prerequisite', '*.body']) {
      expect(redactPaths).toContain(path);
    }
  });
});
