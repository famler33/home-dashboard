import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { Settings } from '../../config/schema.js';
import type { Source } from '../source.js';
import { planBasemap } from './basemap.js';
import { getJson, roundForUpstream, UpstreamError } from './http.js';
import { cellForLonLat, type Corners } from './radar-geo.js';
import type { RadarStore } from './radar-store.js';
import type { RadarDocument, RadarPayload } from './types.js';

const GRID = 101;
const MAX_FRAMES = 60;
const MAX_BYTES = 6_000_000;
const MM_PER_HOUR_PER_UNIT = 0.12; // value = 0.01 mm per 5 minutes
const BASEMAP_ZOOM = 9;

const upstreamSchema = Type.Object({
  radar: Type.Array(
    Type.Object({
      timestamp: Type.String(),
      precipitation_5: Type.Array(Type.Array(Type.Union([Type.Number(), Type.Null()]))),
    }),
  ),
  geometry: Type.Object({
    coordinates: Type.Array(Type.Tuple([Type.Number(), Type.Number()]), {
      minItems: 4,
      maxItems: 4,
    }),
  }),
});

function toBytes(grid: (number | null)[][]): Uint8Array {
  const bytes = new Uint8Array(GRID * GRID);
  grid.forEach((row, r) =>
    row.forEach((value, c) => {
      bytes[r * GRID + c] = value === null || value < 0 ? 0 : Math.min(255, Math.round(value));
    }),
  );
  return bytes;
}

export function createRadarSource(deps: {
  location: Settings['location'];
  fetchImpl: typeof fetch;
  userAgent: string;
  radarStore: RadarStore;
  now?: () => number;
}): Source<RadarPayload> {
  const now = deps.now ?? Date.now;

  return {
    id: 'weather-radar',
    intervalSeconds: 300,
    staleAfterSeconds: 600,
    timeoutMs: 20_000,
    async fetch(signal) {
      const nowMs = now();
      const url = new URL('https://api.brightsky.dev/radar');
      url.searchParams.set('lat', String(roundForUpstream(deps.location.latitude)));
      url.searchParams.set('lon', String(roundForUpstream(deps.location.longitude)));
      url.searchParams.set('distance', '50000');
      url.searchParams.set('format', 'plain');
      url.searchParams.set('date', new Date(nowMs - 3_600_000).toISOString());
      url.searchParams.set('last_date', new Date(nowMs + 2 * 3_600_000).toISOString());

      const raw = await getJson(deps.fetchImpl, url, {
        signal,
        userAgent: deps.userAgent,
        maxBytes: MAX_BYTES,
      });
      if (!Value.Check(upstreamSchema, raw)) throw new UpstreamError();
      const { radar, geometry } = raw;
      if (radar.length === 0 || radar.length > MAX_FRAMES) throw new UpstreamError();
      for (const frame of radar) {
        const grid = frame.precipitation_5;
        if (grid.length !== GRID || grid.some((row) => row.length !== GRID))
          throw new UpstreamError();
      }

      const corners = geometry.coordinates as Corners;
      const home = cellForLonLat(corners, GRID, deps.location.longitude, deps.location.latitude);
      if (!home) throw new UpstreamError();

      const frames = radar
        .map((frame) => ({ ms: Date.parse(frame.timestamp), grid: frame.precipitation_5 }))
        .filter((frame) => !Number.isNaN(frame.ms))
        .sort((a, b) => a.ms - b.ms);
      if (frames.length === 0) throw new UpstreamError();

      const kinds = frames.map(
        (frame) => (frame.ms <= nowMs ? 'observed' : 'forecast') as 'observed' | 'forecast',
      );
      const newestObserved = frames.findLast((frame) => frame.ms <= nowMs) ?? frames[0]!;
      const version = new Date(newestObserved.ms).toISOString();

      const doc: RadarDocument = {
        version,
        size: GRID,
        corners,
        home: {
          col: home.col,
          row: home.row,
          lat: deps.location.latitude,
          lon: deps.location.longitude,
        },
        map: { zoom: BASEMAP_ZOOM, tileSize: 256, tiles: planBasemap(corners, BASEMAP_ZOOM) },
        frames: frames.map((frame, index) => ({
          time: new Date(frame.ms).toISOString(),
          kind: kinds[index] ?? 'forecast',
          values: Buffer.from(toBytes(frame.grid)).toString('base64'),
        })),
      };
      deps.radarStore.save(doc, nowMs);

      return {
        version,
        frames: doc.frames.map((frame) => ({ time: frame.time, kind: frame.kind })),
        homeSeries: frames.map((frame) => ({
          time: new Date(frame.ms).toISOString(),
          mmPerHour: (frame.grid[home.row]?.[home.col] ?? 0) * MM_PER_HOUR_PER_UNIT,
        })),
      };
    },
  };
}
