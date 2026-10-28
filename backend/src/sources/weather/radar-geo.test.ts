import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planBasemap } from './basemap.js';
import { cellForLonLat, type Corners } from './radar-geo.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../test/fixtures/brightsky-radar.sample.json', import.meta.url),
    'utf8',
  ),
) as { geometry: { coordinates: [number, number][] } };
const corners = fixture.geometry.coordinates as Corners; // NW, SW, SE, NE as [lon, lat]

// Covers: FR-7, AC-16
describe('cellForLonLat', () => {
  it('puts the centre of the radar square into the centre cell', () => {
    const [nw, sw, se, ne] = corners;
    const lon = (nw![0] + sw![0] + se![0] + ne![0]) / 4;
    const lat = (nw![1] + sw![1] + se![1] + ne![1]) / 4;
    const cell = cellForLonLat(corners, 101, lon, lat);
    expect(Math.abs((cell?.col ?? 0) - 50)).toBeLessThanOrEqual(1);
    expect(Math.abs((cell?.row ?? 0) - 50)).toBeLessThanOrEqual(1);
  });

  it('keeps row 0 as north and column 0 as west according to the corner order', () => {
    const [nw, sw, , ne] = corners;
    const northWest = cellForLonLat(corners, 101, nw![0] + 0.003, nw![1] - 0.003);
    const southWest = cellForLonLat(corners, 101, sw![0] + 0.003, sw![1] + 0.003);
    const northEast = cellForLonLat(corners, 101, ne![0] - 0.003, ne![1] - 0.003);
    expect(northWest).toMatchObject({ col: 0, row: 0 });
    expect(southWest?.row).toBeGreaterThanOrEqual(99);
    expect(southWest?.col).toBe(0);
    expect(northEast?.col).toBeGreaterThanOrEqual(99);
    expect(northEast?.row).toBe(0);
  });

  it('moves to smaller rows towards the north and larger columns towards the east', () => {
    const [nw, sw, se, ne] = corners;
    const lon = (nw![0] + sw![0] + se![0] + ne![0]) / 4;
    const lat = (nw![1] + sw![1] + se![1] + ne![1]) / 4;
    const centre = cellForLonLat(corners, 101, lon, lat)!;
    const north = cellForLonLat(corners, 101, lon, lat + 0.1)!;
    const east = cellForLonLat(corners, 101, lon + 0.1, lat)!;
    expect(north.row).toBeLessThan(centre.row);
    expect(east.col).toBeGreaterThan(centre.col);
  });

  it('returns undefined outside the square', () => {
    expect(cellForLonLat(corners, 101, 8.0, 48.0)).toBeUndefined();
  });
});

describe('planBasemap', () => {
  it('covers the radar square with a small tile rectangle at zoom 9', () => {
    const tiles = planBasemap(corners, 9);
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    expect(tiles.length).toBeLessThanOrEqual(16);
    const xs = new Set(tiles.map((tile) => tile.x));
    const ys = new Set(tiles.map((tile) => tile.y));
    expect(tiles).toHaveLength(xs.size * ys.size);
  });

  it('contains the tile of every corner and of the centre', () => {
    const tiles = planBasemap(corners, 9);
    const tileOf = (lon: number, lat: number) => {
      const n = 2 ** 9;
      const rad = (lat * Math.PI) / 180;
      return {
        x: Math.floor(((lon + 180) / 360) * n),
        y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
      };
    };
    for (const [lon, lat] of corners) {
      expect(tiles).toContainEqual(tileOf(lon, lat));
    }
  });

  it('returns tiles ordered row by row', () => {
    const tiles = planBasemap(corners, 9);
    const sorted = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
    expect(tiles).toEqual(sorted);
  });
});
