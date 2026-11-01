import { readFileSync } from 'node:fs';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it, vi } from 'vitest';
import { createRadarSource } from './radar-source.js';
import { cellForLonLat } from './radar-geo.js';
import type { Corners } from './radar-geo.js';
import type { RadarStore } from './radar-store.js';
import { radarPayloadSchema, type RadarDocument } from './types.js';

type RadarBody = {
  radar: { timestamp: string; source: string; precipitation_5: (number | null)[][] }[];
  geometry: { coordinates: [number, number][] };
  bbox: number[];
};
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../test/fixtures/brightsky-radar.sample.json', import.meta.url),
    'utf8',
  ),
) as RadarBody;

const location = { name: 'Zuhause', latitude: 52.5234, longitude: 13.405 };
const now = Date.parse('2026-10-28T13:50:00Z'); // frames: 12:40, 13:10, 13:40 observed; 14:10, 14:40 forecast
const signal = new AbortController().signal;

function fakeStore() {
  const saved: { doc: RadarDocument; now: number }[] = [];
  const store: RadarStore = {
    save: (doc, at) => void saved.push({ doc, now: at }),
    load: () => undefined,
  };
  return { store, saved };
}

function create(body: unknown = fixture, status = 200) {
  const { store, saved } = fakeStore();
  const fetchImpl = vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
  const source = createRadarSource({
    location,
    fetchImpl,
    userAgent: 'home-dashboard/test',
    radarStore: store,
    now: () => now,
  });
  return { source, saved, fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

const home = () =>
  cellForLonLat(
    fixture.geometry.coordinates as Corners,
    101,
    location.longitude,
    location.latitude,
  )!;

// Covers: FR-7, FR-8, FR-12, AC-16, AC-17, AC-18, AC-36
describe('radar source', () => {
  it('declares its id, interval, stale threshold and timeout', () => {
    const { source } = create();
    expect(source.id).toBe('weather-radar');
    expect(source.intervalSeconds).toBe(300);
    expect(source.staleAfterSeconds).toBe(600);
    expect(source.timeoutMs).toBe(20_000);
  });

  it('turns the radar fixture into frames of 101x101 bytes and a small payload', async () => {
    const { source, saved } = create();
    const payload = await source.fetch(signal);
    expect(Value.Check(radarPayloadSchema, payload)).toBe(true);
    expect(payload.frames).toHaveLength(5);
    expect(saved).toHaveLength(1);
    const doc = saved[0]!.doc;
    expect(doc.size).toBe(101);
    expect(doc.frames).toHaveLength(5);
    for (const frame of doc.frames) {
      expect(Buffer.from(frame.values, 'base64')).toHaveLength(101 * 101);
    }
  });

  it('marks frames after now as forecast and uses the newest observed frame as version', async () => {
    const { source, saved } = create();
    const payload = await source.fetch(signal);
    expect(payload.frames.map((frame) => frame.kind)).toEqual([
      'observed',
      'observed',
      'observed',
      'forecast',
      'forecast',
    ]);
    expect(payload.version).toBe('2026-10-28T13:40:00.000Z');
    expect(saved[0]!.doc.version).toBe(payload.version);
    expect(saved[0]!.doc.frames.map((frame) => frame.kind)).toEqual(
      payload.frames.map((frame) => frame.kind),
    );
  });

  it('derives the rain series from the cell that contains the true home position', async () => {
    const cell = home();
    const body = structuredClone(fixture);
    body.radar[2]!.precipitation_5[cell.row]![cell.col] = 50;
    body.radar[3]!.precipitation_5[cell.row]![cell.col] = 25;
    body.radar[4]!.precipitation_5[50]![50] = 99; // neighbouring/centre cell must not leak in unless it is the home cell
    const { source, saved } = create(body);
    const payload = await source.fetch(signal);
    expect(payload.homeSeries).toHaveLength(5);
    expect(payload.homeSeries[2]?.mmPerHour).toBeCloseTo(6, 5);
    expect(payload.homeSeries[3]?.mmPerHour).toBeCloseTo(3, 5);
    expect(saved[0]!.doc.home).toMatchObject({
      col: cell.col,
      row: cell.row,
      lat: location.latitude,
      lon: location.longitude,
    });
  });

  it('clamps values to 0-255 and maps missing or negative values to 0', async () => {
    const body = structuredClone(fixture);
    body.radar[0]!.precipitation_5[0]![0] = 300;
    body.radar[0]!.precipitation_5[0]![1] = null;
    body.radar[0]!.precipitation_5[0]![2] = -5;
    const { source, saved } = create(body);
    await source.fetch(signal);
    const bytes = Buffer.from(saved[0]!.doc.frames[0]!.values, 'base64');
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([255, 0, 0]);
  });

  it('keeps the corner order and plans the basemap tiles at zoom 9', async () => {
    const { source, saved } = create();
    await source.fetch(signal);
    const doc = saved[0]!.doc;
    expect(doc.corners).toEqual(fixture.geometry.coordinates);
    expect(doc.map.zoom).toBe(9);
    expect(doc.map.tileSize).toBe(256);
    expect(doc.map.tiles.length).toBeGreaterThanOrEqual(4);
  });

  it('requests the radar for the rounded home location with a window from one hour back to two hours ahead', async () => {
    const { source, fetchImpl } = create();
    await source.fetch(signal);
    const url = fetchImpl.mock.calls[0]?.[0] as URL;
    expect(url.hostname).toBe('api.brightsky.dev');
    expect(url.pathname).toBe('/radar');
    expect(url.searchParams.get('lat')).toBe('52.52');
    expect(url.searchParams.get('lon')).toBe('13.41');
    expect(url.searchParams.get('distance')).toBe('50000');
    expect(url.searchParams.get('format')).toBe('plain');
    expect(Date.parse(url.searchParams.get('date') ?? '')).toBe(now - 3_600_000);
    expect(Date.parse(url.searchParams.get('last_date') ?? '')).toBe(now + 2 * 3_600_000);
  });

  it.each([
    ['no frames', (body: RadarBody) => (body.radar = [])],
    ['a wrong grid width', (body: RadarBody) => (body.radar[0]!.precipitation_5[0] = [1, 2, 3])],
    ['a wrong grid height', (body: RadarBody) => body.radar[0]!.precipitation_5.pop()],
    ['missing geometry', (body: RadarBody) => delete (body as Partial<RadarBody>).geometry],
    ['three corners only', (body: RadarBody) => body.geometry.coordinates.pop()],
  ])('rejects %s and saves nothing', async (_label, mutate) => {
    const broken = structuredClone(fixture);
    mutate(broken);
    const { source, saved } = create(broken);
    await expect(source.fetch(signal)).rejects.toThrow();
    expect(saved).toHaveLength(0);
  });

  it('rejects non-ok responses and keeps the stored document untouched', async () => {
    const { source, saved } = create({}, 503);
    await expect(source.fetch(signal)).rejects.toThrow();
    expect(saved).toHaveLength(0);
  });
});
