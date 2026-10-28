import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeFrames } from './radar-render';
import { installCanvasMock, type CanvasMock } from './canvas-mock';
import { RadarCanvas } from './RadarCanvas';
import { radarDocumentFixture } from './test-data';

let mock: CanvasMock;
const doc = radarDocumentFixture();
const frames = decodeFrames(doc);

beforeEach(() => {
  mock = installCanvasMock();
});

afterEach(() => {
  mock.restore();
});

const show = (props: Partial<Parameters<typeof RadarCanvas>[0]> = {}) =>
  render(<RadarCanvas doc={doc} frames={frames} frameIndex={1} night={false} {...props} />);

// Covers: FR-7, FR-8, AC-16, AC-19, NFR-2, NFR-4
describe('RadarCanvas', () => {
  it('requests every basemap tile of the document from the own origin', async () => {
    show();
    await waitFor(() => expect(mock.images).toHaveLength(doc.map.tiles.length));
    for (const tile of doc.map.tiles) {
      expect(mock.images.map((image) => image.src)).toContain(
        `/api/v1/weather/basemap/${doc.map.zoom}/${tile.x}/${tile.y}`,
      );
    }
    expect(mock.images.every((image) => image.src.startsWith('/api/'))).toBe(true);
  });

  it('draws the tiles and the radar frame and marks the basemap as ready', async () => {
    const { container } = show();
    await waitFor(() => expect(container.querySelector('[data-basemap="ready"]')).not.toBeNull());
    expect(mock.context['drawImage']).toHaveBeenCalledTimes(doc.map.tiles.length);
    expect(mock.context['putImageData']).toHaveBeenCalled();
    const image = mock.context['putImageData']!.mock.calls.at(-1)![0] as ImageData;
    expect(image.width).toBe(512);
    expect(image.height).toBe(320);
    expect(image.data.some((value) => value > 0)).toBe(true);
  });

  it('draws a different picture for a different frame', async () => {
    const { rerender } = show({ frameIndex: 0 });
    await waitFor(() => expect(mock.context['putImageData']).toHaveBeenCalled());
    const first = Array.from(
      (mock.context['putImageData']!.mock.calls.at(-1)![0] as ImageData).data,
    );
    rerender(<RadarCanvas doc={doc} frames={frames} frameIndex={3} night={false} />);
    await waitFor(() => expect(mock.context['putImageData']!.mock.calls.length).toBeGreaterThan(1));
    const second = Array.from(
      (mock.context['putImageData']!.mock.calls.at(-1)![0] as ImageData).data,
    );
    expect(second).not.toEqual(first);
  });

  it('draws the home marker', async () => {
    show();
    await waitFor(() => expect(mock.context['arc']).toHaveBeenCalled());
    expect(mock.context['stroke']).toHaveBeenCalled();
  });

  it('draws range rings over a plain surface when the tiles cannot be loaded', async () => {
    mock.failTiles();
    const { container } = show();
    await waitFor(() => expect(container.querySelector('[data-basemap="failed"]')).not.toBeNull());
    const radii = mock.context['arc']!.mock.calls.map((call) => call[2] as number);
    expect(radii.filter((radius) => radius > 20).length).toBeGreaterThanOrEqual(2);
    expect(mock.context['putImageData']).toHaveBeenCalled();
  });

  it('exposes the map as an image with a German name', () => {
    show();
    expect(screen.getByRole('img', { name: 'Regenradar der Umgebung' })).toBeInTheDocument();
  });

  it('applies a night filter to the basemap only at night', () => {
    const day = show();
    expect(day.container.querySelector('canvas')!.className).not.toContain('invert');
    day.unmount();
    const night = show({ night: true });
    expect(night.container.querySelector('canvas')!.className).toContain('invert');
  });

  it('draws nothing and starts no timer when there are no frames', () => {
    vi.useFakeTimers();
    show({ frames: [] });
    expect(mock.context['putImageData']).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
