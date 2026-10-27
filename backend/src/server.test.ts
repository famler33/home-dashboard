import { mkdirSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError } from './config/load-config.js';
import { startServer, type RunningServer } from './server.js';

const settings = `
timezone: Europe/Berlin
location: { name: Zuhause, latitude: 52.52, longitude: 13.405 }
display: { nightFrom: "22:00", nightTo: "06:30", dailyReloadAt: "04:00" }
sources: { demo: { enabled: true } }
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
