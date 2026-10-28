import { mkdirSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tinyPng } from '../test/helpers/png.js';
import { ConfigError } from './config/load-config.js';
import type { FeedTransport } from './sources/calendar/feed-transport.js';
import { FeedRejected } from './sources/calendar/feed-url.js';
import { startServer, type RunningServer } from './server.js';

const settings = `
timezone: Europe/Berlin
location: { name: Zuhause, latitude: 52.52, longitude: 13.405 }
display: { nightFrom: "22:00", nightTo: "06:30", dailyReloadAt: "04:00" }
sources: { demo: { enabled: true }, weather: { enabled: false } }
backup: { time: "03:00", retention: 14 }
`;

let root: string;
let server: RunningServer | undefined;

function env(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    CONFIG_DIR: join(root, 'config'),
    DATA_DIR: join(root, 'data'),
    BACKUP_DIR: join(root, 'backup'),
    HOST: '127.0.0.1',
    PORT: '0',
    BUILD_ID: 'test-build',
    ...extra,
  };
}

async function waitFor<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('condition not met in time');
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dashboard-server-'));
  mkdirSync(join(root, 'config'));
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'config', 'settings.yaml'), settings);
  chmodSync(join(root, 'config', 'settings.yaml'), 0o600);
});

afterEach(async () => {
  await server?.stop();
  server = undefined;
  rmSync(root, { recursive: true, force: true });
});

// Covers: FR-8, FR-18, FR-20, AC-14, AC-22, AC-24, AC-29
describe('startServer', () => {
  it('answers /api/v1/health after startup', async () => {
    server = await startServer(env());
    const response = await fetch(`${server.url}/api/v1/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('refreshes the demo source right after start and reports it in the snapshot', async () => {
    server = await startServer(env());
    const entry = await waitFor(async () => {
      const body = (await (await fetch(`${server!.url}/api/v1/snapshot`)).json()) as {
        buildId: string;
        sources: { id: string; status: string; data: { value: number } | null }[];
      };
      expect(body.buildId).toBe('test-build');
      return body.sources.find((source) => source.status === 'fresh');
    });
    expect(entry).toMatchObject({ id: 'demo', data: { value: 1 } });
  });

  it('serves no sources when the demo source is disabled', async () => {
    writeFileSync(
      join(root, 'config', 'settings.yaml'),
      settings.replace('demo: { enabled: true }', 'demo: { enabled: false }'),
    );
    server = await startServer(env());
    const body = (await (await fetch(`${server.url}/api/v1/snapshot`)).json()) as {
      sources: unknown[];
    };
    expect(body.sources).toEqual([]);
  });

  it('fails closed with a ConfigError when settings are invalid', async () => {
    writeFileSync(join(root, 'config', 'settings.yaml'), 'timezone: nonsense\n');
    await expect(startServer(env())).rejects.toBeInstanceOf(ConfigError);
  });

  it('serves the SPA from STATIC_DIR when configured', async () => {
    const staticDir = join(root, 'static');
    mkdirSync(staticDir);
    writeFileSync(join(staticDir, 'index.html'), '<title>Dashboard</title>');
    server = await startServer(env({ STATIC_DIR: staticDir }));
    const response = await fetch(`${server.url}/`);
    expect(await response.text()).toContain('Dashboard');
  });

  it('stops cleanly and can start again on the same files', async () => {
    server = await startServer(env());
    await server.stop();
    server = await startServer(env());
    expect((await fetch(`${server.url}/api/v1/health`)).status).toBe(200);
  });
});

const fixtureText = (name: string) =>
  readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8');

// Covers: FR-8, FR-12, NFR-4, NFR-5, AC-16, AC-36, AC-39
describe('startServer weather wiring', () => {
  const weatherNow = () => Date.parse('2026-10-28T13:50:00Z');

  function routedFetch() {
    const hosts: string[] = [];
    const fetchImpl = vi.fn(async (input: URL | string | Request) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      hosts.push(url.hostname);
      if (url.hostname === 'api.open-meteo.com')
        return new Response(fixtureText('open-meteo.sample.json'));
      if (url.hostname === 'api.brightsky.dev' && url.pathname === '/radar')
        return new Response(fixtureText('brightsky-radar.sample.json'));
      if (url.hostname === 'api.brightsky.dev' && url.pathname === '/alerts')
        return new Response(fixtureText('brightsky-alerts.sample.json'));
      if (url.hostname === 'tile.openstreetmap.org')
        return new Response(tinyPng, { headers: { 'content-type': 'image/png' } });
      return new Response('unexpected host', { status: 500 });
    }) as unknown as typeof fetch;
    return { fetchImpl, hosts };
  }

  const settingsWith = (weather: string) =>
    settings.replace(
      'sources: { demo: { enabled: true }, weather: { enabled: false } }',
      `sources: { demo: { enabled: false }${weather} }`,
    );

  async function snapshot(url: string) {
    return (await (await fetch(`${url}/api/v1/snapshot`)).json()) as {
      sources: { id: string; status: string; data: unknown }[];
    };
  }

  it('registers the three weather sources by default and serves the radar document and tiles', async () => {
    writeFileSync(join(root, 'config', 'settings.yaml'), settingsWith(''));
    const { fetchImpl, hosts } = routedFetch();
    server = await startServer(env(), { fetchImpl, now: weatherNow });

    const entries = await waitFor(async () => {
      const body = await snapshot(server!.url);
      return body.sources.filter((source) => source.status === 'fresh').length === 3
        ? body.sources
        : undefined;
    });
    expect(entries.map((entry) => entry.id).sort()).toEqual([
      'weather',
      'weather-alerts',
      'weather-radar',
    ]);
    expect(new Set(hosts)).toEqual(new Set(['api.open-meteo.com', 'api.brightsky.dev']));

    const radar = await fetch(`${server.url}/api/v1/weather/radar`);
    expect(radar.status).toBe(200);
    // fetch decompresses the gzip body itself
    const doc = (await radar.json()) as {
      map: { zoom: number; tiles: { x: number; y: number }[] };
    };
    const tile = doc.map.tiles[0]!;
    const png = await fetch(
      `${server.url}/api/v1/weather/basemap/${doc.map.zoom}/${tile.x}/${tile.y}`,
    );
    expect(png.status).toBe(200);
    expect(png.headers.get('cache-control')).toBe('private, max-age=86400');
    expect((await fetch(`${server.url}/api/v1/weather/basemap/${doc.map.zoom}/1/1`)).status).toBe(
      404,
    );
    expect(hosts).toContain('tile.openstreetmap.org');
  });

  it('keeps the allow-list after a restart from the stored radar document', async () => {
    writeFileSync(join(root, 'config', 'settings.yaml'), settingsWith(''));
    const first = routedFetch();
    server = await startServer(env(), { fetchImpl: first.fetchImpl, now: weatherNow });
    await waitFor(async () =>
      (await snapshot(server!.url)).sources.some(
        (s) => s.id === 'weather-radar' && s.status === 'fresh',
      )
        ? true
        : undefined,
    );
    await server.stop();

    const failing = vi.fn(
      async () => new Response('down', { status: 503 }),
    ) as unknown as typeof fetch;
    server = await startServer(env(), { fetchImpl: failing, now: weatherNow });
    const radar = await fetch(`${server.url}/api/v1/weather/radar`);
    expect(radar.status).toBe(200);
  });

  it('registers none of the weather sources and no weather routes when disabled', async () => {
    writeFileSync(
      join(root, 'config', 'settings.yaml'),
      settingsWith(', weather: { enabled: false }'),
    );
    const { fetchImpl, hosts } = routedFetch();
    server = await startServer(env(), { fetchImpl, now: weatherNow });
    expect((await snapshot(server.url)).sources).toEqual([]);
    expect((await fetch(`${server.url}/api/v1/weather/radar`)).status).toBe(404);
    expect(hosts).toEqual([]);
  });

  it('keeps the other two weather sources fresh when one upstream fails', async () => {
    writeFileSync(join(root, 'config', 'settings.yaml'), settingsWith(''));
    const inner = routedFetch().fetchImpl;
    const fetchImpl = vi.fn(async (input: URL | string | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      if (url.pathname === '/radar') return new Response('down', { status: 503 });
      return inner(input, init);
    }) as unknown as typeof fetch;
    server = await startServer(env(), { fetchImpl, now: weatherNow });
    const entries = await waitFor(async () => {
      const body = await snapshot(server!.url);
      const done = body.sources.filter((source) => source.status !== 'never-loaded').length === 3;
      return done ? body.sources : undefined;
    });
    const status = Object.fromEntries(entries.map((entry) => [entry.id, entry.status]));
    expect(status).toEqual({
      weather: 'fresh',
      'weather-alerts': 'fresh',
      'weather-radar': 'error',
    });
  });
});

describe('startServer calendar wiring', () => {
  const icsFamily = readFileSync(
    new URL('../test/fixtures/calendar/icloud-family.sample.ics', import.meta.url),
    'utf8',
  );
  const calendarSettings = (family: boolean, person1 = false, tile = true) =>
    settings.replace(
      'sources: { demo: { enabled: true }, weather: { enabled: false } }',
      `sources: { demo: { enabled: false }, weather: { enabled: false }, calendar: { enabled: ${tile}, kitaKeyword: Kita, calendars: {
        family: { enabled: ${family}, name: Familie, color: blue },
        person-1: { enabled: ${person1}, name: Alex, color: green },
        person-2: { enabled: false, name: Ben, color: orange } } } }`,
    );
  const credentials = (person1 = false) =>
    `calendar-family:\n  url: webcal://p12-caldav.icloud.com/published/2/SENTINEL-FAMILY\n${
      person1
        ? 'calendar-person-1:\n  url: https://calendar.google.com/calendar/ical/x/private-SENTINEL-WORK/basic.ics\n'
        : ''
    }`;
  const calendarNow = () => Date.parse('2026-10-28T10:00:00Z');

  function configure(text: string, creds: string) {
    writeFileSync(join(root, 'config', 'settings.yaml'), text);
    writeFileSync(join(root, 'config', 'credentials.yaml'), creds);
    chmodSync(join(root, 'config', 'credentials.yaml'), 0o600);
  }

  async function snapshot(url: string) {
    return (await (await fetch(`${url}/api/v1/snapshot`)).json()) as {
      settings: { calendar?: unknown };
      sources: { id: string; status: string; data: unknown }[];
    };
  }

  it('registers one source per enabled calendar and projects names and colours', async () => {
    configure(calendarSettings(true, true), credentials(true));
    const seen: string[] = [];
    const calendarTransport: FeedTransport = async (feed) => {
      seen.push(feed.hostname);
      return { status: 200, text: icsFamily };
    };
    server = await startServer(env(), { calendarTransport, now: calendarNow });
    const body = await waitFor(async () => {
      const value = await snapshot(server!.url);
      return value.sources.filter((entry) => entry.status === 'fresh').length === 2
        ? value
        : undefined;
    });
    expect(body.sources.map((entry) => entry.id)).toEqual(['calendar-family', 'calendar-person-1']);
    expect(body.settings.calendar).toEqual({
      kitaKeyword: 'Kita',
      calendars: [
        { id: 'family', name: 'Familie', color: 'blue', role: 'family' },
        { id: 'person-1', name: 'Alex', color: 'green', role: 'person' },
      ],
    });
    expect(seen.sort()).toEqual(['calendar.google.com', 'p12-caldav.icloud.com']);
  });

  it('creates no source for a disabled calendar and none when the tile is off', async () => {
    configure(calendarSettings(true, false), credentials());
    server = await startServer(env(), {
      calendarTransport: async () => ({ status: 200, text: icsFamily }),
      now: calendarNow,
    });
    expect((await snapshot(server.url)).sources.map((entry) => entry.id)).toEqual([
      'calendar-family',
    ]);
    await server.stop();

    configure(calendarSettings(true, false, false), credentials());
    server = await startServer(env(), {
      calendarTransport: async () => ({ status: 200, text: icsFamily }),
      now: calendarNow,
    });
    const body = await snapshot(server.url);
    expect(body.sources).toEqual([]);
    expect(body.settings.calendar).toBeUndefined();
  });

  it('keeps the other calendar fresh when one feed fails', async () => {
    configure(calendarSettings(true, true), credentials(true));
    const calendarTransport: FeedTransport = async (feed) => {
      if (feed.hostname === 'calendar.google.com') throw new FeedRejected('status');
      return { status: 200, text: icsFamily };
    };
    server = await startServer(env(), { calendarTransport, now: calendarNow });
    const body = await waitFor(async () => {
      const value = await snapshot(server!.url);
      return value.sources.every((entry) => entry.status !== 'never-loaded') ? value : undefined;
    });
    const byId = Object.fromEntries(body.sources.map((entry) => [entry.id, entry.status]));
    expect(byId).toEqual({ 'calendar-family': 'fresh', 'calendar-person-1': 'error' });
  });

  it('never returns a feed address in the snapshot, health or error responses', async () => {
    configure(calendarSettings(true, true), credentials(true));
    server = await startServer(env(), {
      calendarTransport: async () => ({ status: 200, text: icsFamily }),
      now: calendarNow,
    });
    await waitFor(async () => {
      const value = await snapshot(server!.url);
      return value.sources.every((entry) => entry.status === 'fresh') ? value : undefined;
    });
    for (const path of ['/api/v1/snapshot', '/api/v1/health', '/api/v1/nope', '/']) {
      const text = await (await fetch(`${server.url}${path}`)).text();
      expect(text, path).not.toContain('SENTINEL');
      expect(text, path).not.toContain('icloud.com/published');
    }
  });

  it('keeps feed addresses out of the database file', async () => {
    configure(calendarSettings(true, true), credentials(true));
    server = await startServer(env(), {
      calendarTransport: async () => ({ status: 200, text: icsFamily }),
      now: calendarNow,
    });
    await waitFor(async () => {
      const value = await snapshot(server!.url);
      return value.sources.every((entry) => entry.status === 'fresh') ? value : undefined;
    });
    await server.stop();
    server = undefined;
    const database = readFileSync(join(root, 'data', 'dashboard.sqlite'));
    expect(database.includes('SENTINEL')).toBe(false);
  });

  it('exposes no route that changes or refreshes a calendar', async () => {
    configure(calendarSettings(true), credentials());
    server = await startServer(env(), {
      calendarTransport: async () => ({ status: 200, text: icsFamily }),
      now: calendarNow,
    });
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      for (const path of ['/api/v1/calendar', '/api/v1/calendar/refresh', '/api/v1/snapshot']) {
        const response = await fetch(`${server.url}${path}`, { method });
        expect(response.status, `${method} ${path}`).toBeGreaterThanOrEqual(400);
      }
    }
  });
});
