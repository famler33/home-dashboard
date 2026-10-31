import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createSnapshotStore } from '../cache/snapshot-store.js';
import { systemClock } from '../clock.js';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { testConfig } from '../../test/helpers/test-config.js';
import { createListsService } from './lists-service.js';
import { createListsSource } from './lists-source.js';
import type { ListsState } from './lists-types.js';

let app: FastifyInstance | undefined;
const logLines: string[] = [];
const logStream = new Writable({
  write(chunk, _encoding, callback) {
    logLines.push(String(chunk));
    callback();
  },
});

async function start() {
  logLines.length = 0;
  const db = new Database(':memory:');
  runMigrations(db, migrationsDir);
  const store = createSnapshotStore(db);
  const service = createListsService({
    db,
    store,
    now: () => Date.now(),
    timezone: 'Europe/Berlin',
  });
  const config = testConfig();
  config.settings.network = { allowedHosts: ['dashboard.home'] };
  app = await buildApp({
    config,
    store,
    clock: systemClock,
    sources: [createListsSource(service, () => Date.now())],
    buildId: 'test',
    lists: service,
    logger: { level: 'info', stream: logStream },
  });
  return { app, service, store };
}

const headers = { host: 'dashboard.home', 'content-type': 'application/json' };
const request = (
  instance: FastifyInstance,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
  extra: Record<string, string> = {},
) =>
  instance.inject({
    method,
    url,
    headers: { ...headers, ...extra },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });

afterEach(async () => {
  await app?.close();
  app = undefined;
});

// Covers: FR-1, FR-5, FR-6, FR-7, FR-8, NFR-3, NFR-7, AC-2, AC-5, AC-40, AC-41, AC-44, AC-45
describe('lists routes', () => {
  it('serves the full state, answers 201 for a new entry and 200 for the same id', async () => {
    const { app: instance } = await start();
    const itemId = randomUUID();
    const body = { id: itemId, list: 'shopping', title: 'Milch' };
    const created = await request(instance, 'POST', '/api/v1/lists/items', body);
    expect(created.statusCode).toBe(201);
    expect((created.json() as ListsState).shopping[0]?.title).toBe('Milch');
    const again = await request(instance, 'POST', '/api/v1/lists/items', body);
    expect(again.statusCode).toBe(200);
    expect((again.json() as ListsState).shopping).toHaveLength(1);
    const read = await request(instance, 'GET', '/api/v1/lists');
    expect(read.statusCode).toBe(200);
    expect((read.json() as ListsState).categories.length).toBe(10);
  });

  it('needs no cookie, token or header beyond an allowed host', async () => {
    const { app: instance } = await start();
    const response = await instance.inject({
      method: 'GET',
      url: '/api/v1/lists',
      headers: { host: 'dashboard.home' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('adds a to-do, changes it with PATCH, clears with null and removes and restores it', async () => {
    const { app: instance } = await start();
    const todoId = randomUUID();
    await request(instance, 'POST', '/api/v1/lists/items', {
      id: todoId,
      list: 'todo',
      title: 'Regal',
      categoryId: 'balkon',
      priority: 'high',
      effortHours: 1.5,
      prerequisite: 'Material',
    });
    const patched = await request(instance, 'PATCH', `/api/v1/lists/items/${todoId}`, {
      priority: 'low',
      effortHours: null,
      checked: true,
    });
    const item = (patched.json() as ListsState).todos[0]!;
    expect(item).toMatchObject({ priority: 'low', effortHours: null, prerequisite: 'Material' });
    expect(item.checkedAt).not.toBeNull();
    const removed = await request(instance, 'DELETE', `/api/v1/lists/items/${todoId}`);
    expect((removed.json() as ListsState).todos).toHaveLength(0);
    expect((await request(instance, 'DELETE', `/api/v1/lists/items/${todoId}`)).statusCode).toBe(
      200,
    );
    const restored = await request(instance, 'POST', `/api/v1/lists/items/${todoId}/restore`);
    expect((restored.json() as ListsState).todos).toHaveLength(1);
  });

  it('answers 404 NOT_FOUND for unknown ids and does not echo the id', async () => {
    const { app: instance } = await start();
    const unknown = randomUUID();
    for (const [method, url, body] of [
      ['PATCH', `/api/v1/lists/items/${unknown}`, { title: 'x' }],
      ['DELETE', `/api/v1/lists/items/${unknown}`, undefined],
      ['POST', `/api/v1/lists/items/${unknown}/restore`, undefined],
    ] as const) {
      const response = await request(instance, method, url, body);
      expect(response.statusCode, url).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
      expect(response.body).not.toContain(unknown);
    }
  });

  it('answers 400 VALIDATION_FAILED without echoing values for bad bodies and unknown properties', async () => {
    const { app: instance } = await start();
    const bad = [
      { id: 'not-a-uuid', list: 'shopping', title: 'Secret-Titel' },
      { id: randomUUID(), list: 'other', title: 'Secret-Titel' },
      { id: randomUUID(), list: 'shopping', title: 'Secret-Titel', extra: true },
      { id: randomUUID(), list: 'shopping', title: 'x'.repeat(81) },
      {
        id: randomUUID(),
        list: 'todo',
        title: 'Secret-Titel',
        categoryId: 'balkon',
        priority: 'urgent',
      },
      {
        id: randomUUID(),
        list: 'todo',
        title: 'Secret-Titel',
        categoryId: 'balkon',
        effortHours: 0.25,
      },
      { list: 'shopping', title: 'Secret-Titel' },
    ];
    for (const body of bad) {
      const response = await request(instance, 'POST', '/api/v1/lists/items', body);
      expect(response.statusCode, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_FAILED');
      expect(response.body).not.toContain('Secret-Titel');
    }
  });

  it('answers 415 UNSUPPORTED_MEDIA_TYPE for a body that is not JSON', async () => {
    const { app: instance } = await start();
    const response = await instance.inject({
      method: 'POST',
      url: '/api/v1/lists/items',
      headers: { host: 'dashboard.home', 'content-type': 'text/plain' },
      payload: 'Milch',
    });
    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('answers 413 for a body over 4 KiB', async () => {
    const { app: instance } = await start();
    const response = await request(instance, 'POST', '/api/v1/lists/items', {
      id: randomUUID(),
      list: 'shopping',
      title: 'x'.repeat(5000),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('answers 409 for category conflicts and the limit and keeps Sonstiges protected', async () => {
    const { app: instance } = await start();
    const taken = await request(instance, 'POST', '/api/v1/lists/categories', {
      id: randomUUID(),
      name: 'KÜCHE',
    });
    expect(taken.statusCode).toBe(409);
    expect(taken.json().error.code).toBe('CATEGORY_NAME_TAKEN');
    const protectedRename = await request(instance, 'PATCH', '/api/v1/lists/categories/sonstiges', {
      name: 'Andere',
    });
    expect(protectedRename.statusCode).toBe(409);
    expect(protectedRename.json().error.code).toBe('CATEGORY_PROTECTED');
    const protectedDelete = await request(instance, 'DELETE', '/api/v1/lists/categories/sonstiges');
    expect(protectedDelete.json().error.code).toBe('CATEGORY_PROTECTED');
  });

  it('adds, renames, removes and restores a category through the routes', async () => {
    const { app: instance } = await start();
    const categoryId = randomUUID();
    const added = await request(instance, 'POST', '/api/v1/lists/categories', {
      id: categoryId,
      name: 'Garten',
    });
    expect(added.statusCode).toBe(201);
    const renamed = await request(instance, 'PATCH', `/api/v1/lists/categories/${categoryId}`, {
      name: 'Garage',
    });
    expect(
      (renamed.json() as ListsState).categories.some((category) => category.name === 'Garage'),
    ).toBe(true);
    const removed = await request(instance, 'DELETE', `/api/v1/lists/categories/${categoryId}`);
    expect(
      (removed.json() as ListsState).categories.some((category) => category.id === categoryId),
    ).toBe(false);
    const restored = await request(
      instance,
      'POST',
      `/api/v1/lists/categories/${categoryId}/restore`,
    );
    expect(
      (restored.json() as ListsState).categories.some((category) => category.id === categoryId),
    ).toBe(true);
  });

  it('sends no-store on success and error responses and no Access-Control headers', async () => {
    const { app: instance } = await start();
    const ok = await request(instance, 'GET', '/api/v1/lists');
    const bad = await request(instance, 'POST', '/api/v1/lists/items', { nope: 1 });
    const missing = await request(instance, 'DELETE', `/api/v1/lists/items/${randomUUID()}`);
    for (const response of [ok, bad, missing]) {
      expect(response.headers['cache-control']).toBe('no-store');
      expect(
        Object.keys(response.headers).filter((name) => name.startsWith('access-control-')),
      ).toEqual([]);
    }
  });

  it('never logs titles, category names, prerequisites or request bodies', async () => {
    const { app: instance } = await start();
    await request(instance, 'POST', '/api/v1/lists/items', {
      id: randomUUID(),
      list: 'todo',
      title: 'Geheimer-Titel',
      categoryId: 'balkon',
      prerequisite: 'Geheime-Voraussetzung',
    });
    await request(instance, 'POST', '/api/v1/lists/categories', {
      id: randomUUID(),
      name: 'Geheime-Kategorie',
    });
    await request(instance, 'POST', '/api/v1/lists/items', { id: 'x', title: 'Geheimer-Titel-2' });
    const output = logLines.join('');
    for (const secret of ['Geheimer-Titel', 'Geheime-Voraussetzung', 'Geheime-Kategorie']) {
      expect(output).not.toContain(secret);
    }
  });

  it('shows a mutation in the next snapshot', async () => {
    const { app: instance } = await start();
    await request(instance, 'POST', '/api/v1/lists/items', {
      id: randomUUID(),
      list: 'shopping',
      title: 'Milch',
    });
    const snapshot = (await request(instance, 'GET', '/api/v1/snapshot')).json() as {
      sources: { id: string; status: string; data: { counts: { shoppingOpen: number } } }[];
    };
    const entry = snapshot.sources.find((source) => source.id === 'lists')!;
    expect(entry.status).toBe('fresh');
    expect(entry.data.counts.shoppingOpen).toBe(1);
  });

  it('exposes only the documented mutating routes', async () => {
    const { app: instance } = await start();
    const routes = instance.printRoutes({ commonPrefix: false });
    for (const line of routes.split('\n')) {
      if (/POST|PUT|PATCH|DELETE/.test(line)) expect(line).toMatch(/lists/);
    }
    expect(routes).not.toMatch(/config|settings|credentials/);
  });
});
