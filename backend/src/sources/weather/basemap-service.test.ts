import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tinyPng } from '../../../test/helpers/png.js';
import { createBasemapService, NotAllowedError } from './basemap.js';
import { UpstreamError } from './http.js';

let dir: string;
const signal = new AbortController().signal;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dashboard-tiles-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function tileFetch(
  response: () => Response = () =>
    new Response(tinyPng, { headers: { 'content-type': 'image/png' } }),
) {
  return vi.fn(async () => response()) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function service(
  fetchImpl: typeof fetch,
  extra: Partial<Parameters<typeof createBasemapService>[0]> = {},
) {
  const basemap = createBasemapService({
    dir,
    fetchImpl,
    userAgent: 'home-dashboard/test',
    ...extra,
  });
  basemap.setAllowed([
    { z: 9, x: 274, y: 168 },
    { z: 9, x: 275, y: 168 },
    { z: 9, x: 276, y: 168 },
  ]);
  return basemap;
}

const countFiles = () => {
  const walk = (path: string): number =>
    readdirSync(path, { withFileTypes: true }).reduce(
      (sum, entry) => sum + (entry.isDirectory() ? walk(join(path, entry.name)) : 1),
      0,
    );
  return walk(dir);
};

// Covers: FR-8, NFR-4, NFR-5, AC-16, AC-19, AC-21
describe('basemap service', () => {
  it('allows only the listed tiles and only integers', () => {
    const basemap = service(tileFetch());
    expect(basemap.isAllowed(9, 274, 168)).toBe(true);
    expect(basemap.isAllowed(9, 277, 168)).toBe(false);
    expect(basemap.isAllowed(10, 274, 168)).toBe(false);
    expect(basemap.isAllowed(9, 274.5, 168)).toBe(false);
    expect(basemap.isAllowed(9, Number.NaN, 168)).toBe(false);
  });

  it('fetches an uncached tile from the fixed host with an identifying user agent and no referrer or redirects', async () => {
    const fetchImpl = tileFetch();
    const png = await service(fetchImpl).get(9, 274, 168, signal);
    expect(png.equals(tinyPng)).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://tile.openstreetmap.org/9/274/168.png');
    expect(init.redirect).toBe('error');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.credentials).toBe('omit');
    expect(new Headers(init.headers).get('user-agent')).toBe('home-dashboard/test');
  });

  it('caches the tile on disk and serves it without a second request', async () => {
    const fetchImpl = tileFetch();
    const basemap = service(fetchImpl);
    await basemap.get(9, 274, 168, signal);
    expect(existsSync(join(dir, '9', '274', '168.png'))).toBe(true);
    const again = await basemap.get(9, 274, 168, signal);
    expect(again.equals(tinyPng)).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('shares one upstream request between concurrent callers', async () => {
    const fetchImpl = tileFetch();
    const basemap = service(fetchImpl);
    await Promise.all([
      basemap.get(9, 274, 168, signal),
      basemap.get(9, 274, 168, signal),
      basemap.get(9, 274, 168, signal),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses tiles outside the allow-list without any request or file access', async () => {
    const fetchImpl = tileFetch();
    const basemap = service(fetchImpl);
    await expect(basemap.get(9, 1, 1, signal)).rejects.toBeInstanceOf(NotAllowedError);
    await expect(basemap.get(9, 274.5, 168, signal)).rejects.toBeInstanceOf(NotAllowedError);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(countFiles()).toBe(0);
  });

  it.each([
    [
      'a non-PNG body',
      () => new Response('<html>nope</html>', { headers: { 'content-type': 'image/png' } }),
    ],
    [
      'a wrong content type',
      () => new Response(tinyPng, { headers: { 'content-type': 'text/html' } }),
    ],
    [
      'an oversized body',
      () =>
        new Response(Buffer.concat([tinyPng, Buffer.alloc(600 * 1024)]), {
          headers: { 'content-type': 'image/png' },
        }),
    ],
    ['an error status', () => new Response('x', { status: 503 })],
  ])('rejects %s and caches nothing', async (_label, response) => {
    const basemap = service(tileFetch(response));
    await expect(basemap.get(9, 274, 168, signal)).rejects.toBeInstanceOf(UpstreamError);
    expect(countFiles()).toBe(0);
  });

  it('turns network failures and refused redirects into UpstreamError', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('redirect mode is set to error SECRET-LEAK');
    }) as unknown as typeof fetch;
    const error = await service(failing)
      .get(9, 274, 168, signal)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(String((error as Error).message)).not.toContain('SECRET-LEAK');
  });

  it('evicts the oldest tiles beyond the cache cap', async () => {
    const basemap = service(tileFetch(), { maxFiles: 2 });
    await basemap.get(9, 274, 168, signal);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await basemap.get(9, 275, 168, signal);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await basemap.get(9, 276, 168, signal);
    expect(countFiles()).toBe(2);
    expect(existsSync(join(dir, '9', '274', '168.png'))).toBe(false);
    expect(existsSync(join(dir, '9', '276', '168.png'))).toBe(true);
  });

  it('keeps no temporary files behind', async () => {
    await service(tileFetch()).get(9, 274, 168, signal);
    const names = readdirSync(join(dir, '9', '274'));
    expect(names).toEqual(['168.png']);
  });
});
