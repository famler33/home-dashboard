import { describe, expect, it } from 'vitest';
import { buildLookup, cellAt, mapView, worldPixel } from './radar-geo';
import { radarDocumentFixture } from './test-data';

const doc = radarDocumentFixture();

// Covers: FR-7, AC-16
describe('radar geometry', () => {
  it('projects longitude and latitude to Web Mercator world pixels', () => {
    const origin = worldPixel(0, 0, 0, 256);
    expect(origin.x).toBeCloseTo(128, 5);
    expect(origin.y).toBeCloseTo(128, 5);
    const berlin = worldPixel(13.405, 52.52, 9, 256);
    expect(berlin.x).toBeCloseTo(((13.405 + 180) / 360) * 512 * 256, 3);
    expect(Math.floor(berlin.x / 256)).toBe(275);
    expect(Math.floor(berlin.y / 256)).toBe(167);
  });

  it('centres the view on the home position', () => {
    const view = mapView(doc);
    expect(view.width).toBe(512);
    expect(view.height).toBe(320);
    expect(view.homeX).toBeCloseTo(256, 3);
    expect(view.homeY).toBeCloseTo(160, 3);
  });

  it('maps the home pixel to the home cell and keeps north up and east right', () => {
    const view = mapView(doc);
    const lookup = buildLookup(doc, view);
    const at = (x: number, y: number) => lookup[Math.round(y) * view.width + Math.round(x)]!;
    const home = at(view.homeX, view.homeY);
    expect(home).toBeGreaterThanOrEqual(0);
    const homeCell = { row: Math.floor(home / doc.size), col: home % doc.size };
    expect(Math.abs(homeCell.row - doc.home.row)).toBeLessThanOrEqual(1);
    expect(Math.abs(homeCell.col - doc.home.col)).toBeLessThanOrEqual(1);
    const north = at(view.homeX, view.homeY - 40);
    const east = at(view.homeX + 40, view.homeY);
    expect(Math.floor(north / doc.size)).toBeLessThan(homeCell.row);
    expect(east % doc.size).toBeGreaterThan(homeCell.col);
  });

  it('maps every pixel inside the radar polygon to a valid cell and others to -1', () => {
    const view = mapView(doc);
    const lookup = buildLookup(doc, view);
    let inside = 0;
    for (const value of lookup) {
      if (value >= 0) {
        inside += 1;
        expect(value).toBeLessThan(doc.size * doc.size);
      } else {
        expect(value).toBe(-1);
      }
    }
    expect(inside / lookup.length).toBeGreaterThan(0.6);
  });

  it('finds the cell of a position and returns undefined outside the square', () => {
    expect(cellAt(doc, 13.405, 52.52)).toMatchObject({
      col: expect.any(Number),
      row: expect.any(Number),
    });
    expect(cellAt(doc, 8, 48)).toBeUndefined();
  });

  it('computes the lookup quickly enough to stay off the poll cycle', () => {
    const view = mapView(doc);
    const start = performance.now();
    buildLookup(doc, view);
    expect(performance.now() - start).toBeLessThan(400);
  });
});
