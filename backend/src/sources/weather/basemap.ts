import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readLimited, UpstreamError } from './http.js';
import type { Corners } from './radar-geo.js';

function tileXY(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lon + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
}

/** Tiles of one zoom level that cover the radar square, row by row. */
export function planBasemap(corners: Corners, zoom: number): { x: number; y: number }[] {
  const tiles = corners.map(([lon, lat]) => tileXY(lon, lat, zoom));
  const minX = Math.min(...tiles.map((tile) => tile.x));
  const maxX = Math.max(...tiles.map((tile) => tile.x));
  const minY = Math.min(...tiles.map((tile) => tile.y));
  const maxY = Math.max(...tiles.map((tile) => tile.y));
  const plan: { x: number; y: number }[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) plan.push({ x, y });
  }
  return plan;
}

export class NotAllowedError extends Error {
  constructor() {
    super('tile is not part of the current radar area');
    this.name = 'NotAllowedError';
  }
}

export interface BasemapService {
  setAllowed(tiles: { z: number; x: number; y: number }[]): void;
  isAllowed(z: number, x: number, y: number): boolean;
  get(z: number, x: number, y: number, signal: AbortSignal): Promise<Buffer>;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Lazy, bounded cache of OpenStreetMap raster tiles for the fixed radar area. Only tiles from the
 * allow-list (integers computed by the server) ever reach a path or a URL.
 */
export function createBasemapService(deps: {
  dir: string;
  fetchImpl: typeof fetch;
  userAgent: string;
  maxBytes?: number;
  maxFiles?: number;
  maxTotalBytes?: number;
  timeoutMs?: number;
}): BasemapService {
  const maxBytes = deps.maxBytes ?? 512 * 1024;
  const maxFiles = deps.maxFiles ?? 64;
  const maxTotalBytes = deps.maxTotalBytes ?? 8 * 1024 * 1024;
  const timeoutMs = deps.timeoutMs ?? 10_000;
  let allowed = new Set<string>();
  const inflight = new Map<string, Promise<Buffer>>();

  const key = (z: number, x: number, y: number): string => `${z}/${x}/${y}`;

  async function evict(): Promise<void> {
    const files: { path: string; size: number; mtime: number }[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.name.endsWith('.png')) {
          const info = await stat(path);
          files.push({ path, size: info.size, mtime: info.mtimeMs });
        }
      }
    };
    await walk(deps.dir).catch(() => {});
    files.sort((a, b) => a.mtime - b.mtime);
    let total = files.reduce((sum, file) => sum + file.size, 0);
    while (files.length > maxFiles || total > maxTotalBytes) {
      const oldest = files.shift();
      if (!oldest) break;
      total -= oldest.size;
      await rm(oldest.path, { force: true });
    }
  }

  async function load(z: number, x: number, y: number, signal: AbortSignal): Promise<Buffer> {
    const path = join(deps.dir, String(z), String(x), `${y}.png`);
    try {
      return await readFile(path);
    } catch {
      // not cached yet
    }

    const url = new URL(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`);
    let response: Response;
    try {
      response = await deps.fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
        headers: { 'user-agent': deps.userAgent, accept: 'image/png' },
      });
    } catch {
      throw new UpstreamError();
    }
    if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/png')) {
      throw new UpstreamError();
    }
    const bytes = Buffer.from(await readLimited(response, maxBytes));
    if (bytes.length < PNG_MAGIC.length || !bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
      throw new UpstreamError();
    }

    await mkdir(join(deps.dir, String(z), String(x)), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, bytes);
    await rename(temporary, path);
    await evict();
    return bytes;
  }

  return {
    setAllowed(tiles) {
      allowed = new Set(tiles.map((tile) => key(tile.z, tile.x, tile.y)));
    },
    isAllowed(z, x, y) {
      return [z, x, y].every(Number.isInteger) && allowed.has(key(z, x, y));
    },
    get(z, x, y, signal) {
      if (!this.isAllowed(z, x, y)) return Promise.reject(new NotAllowedError());
      const id = key(z, x, y);
      const running = inflight.get(id);
      if (running) return running;
      const promise = load(z, x, y, signal).finally(() => inflight.delete(id));
      inflight.set(id, promise);
      return promise;
    },
  };
}
