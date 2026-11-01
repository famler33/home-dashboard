import { describe, expect, it } from 'vitest';
import { buildLookup, mapView } from './radar-geo';
import { decodeFrames, intensityLegend, intensityRamp, renderFrame } from './radar-render';
import { radarDocumentFixture } from './test-data';

const doc = radarDocumentFixture();

// Covers: FR-7, NFR-2, AC-16, AC-17
describe('radar rendering', () => {
  it('leaves dry cells transparent and colours rain from 0.1 mm/h', () => {
    const ramp = intensityRamp();
    expect(ramp).toHaveLength(256);
    expect(ramp[0]).toBe(0);
    expect(ramp[1]! >>> 24).toBeGreaterThan(0); // raw 1 = 0.12 mm/h
    expect(ramp[255]! >>> 24).toBeGreaterThan(0);
  });

  it('uses different colours for light, moderate and heavy rain', () => {
    const ramp = intensityRamp();
    const colours = new Set([ramp[2], ramp[20], ramp[60], ramp[120], ramp[200]]);
    expect(colours.size).toBe(5);
  });

  it('exposes a legend whose breakpoints match the ramp', () => {
    expect(intensityLegend.map((entry) => entry.mmPerHour)).toEqual([0.1, 0.5, 1, 2.5, 5, 10, 20]);
    for (const entry of intensityLegend) {
      const raw = Math.ceil(entry.mmPerHour / 0.12);
      expect(intensityRamp()[raw]).toBe(entry.colour);
    }
  });

  it('decodes the frames of a radar document into byte grids', () => {
    const frames = decodeFrames(doc);
    expect(frames).toHaveLength(5);
    expect(frames[0]!.bytes).toHaveLength(doc.size * doc.size);
    expect(frames[0]!.kind).toBe('observed');
    expect(frames[4]!.kind).toBe('forecast');
    expect(frames.some((frame) => frame.bytes.some((value) => value > 0))).toBe(true);
  });

  it('colours cells by intensity and leaves dry cells transparent', () => {
    const view = mapView(doc);
    const lookup = buildLookup(doc, view);
    const frame = decodeFrames(doc)[1]!;
    const pixels = new Uint32Array(view.width * view.height);
    renderFrame(frame.bytes, lookup, intensityRamp(), pixels);
    const ramp = intensityRamp();
    let coloured = 0;
    pixels.forEach((value, index) => {
      const cell = lookup[index]!;
      expect(value).toBe(cell < 0 ? 0 : ramp[frame.bytes[cell]!]);
      if (value !== 0) coloured += 1;
    });
    expect(coloured).toBeGreaterThan(0);
  });

  it('renders one frame in well under a frame budget', () => {
    const view = mapView(doc);
    const lookup = buildLookup(doc, view);
    const frame = decodeFrames(doc)[2]!;
    const pixels = new Uint32Array(view.width * view.height);
    const ramp = intensityRamp();
    const start = performance.now();
    for (let i = 0; i < 5; i += 1) renderFrame(frame.bytes, lookup, ramp, pixels);
    expect((performance.now() - start) / 5).toBeLessThan(15);
  });
});
