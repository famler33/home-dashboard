import golden from '../../../../backend/test/fixtures/weather.snapshot.sample.json';
import type { Snapshot, SourceSnapshot } from '../../api/types';
import { snapshotFixture } from '../../test-fixtures';
import type { RadarDocument } from './types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The three weather entries of the backend-owned golden snapshot (times around 2026-10-28T13:50Z). */
export function weatherSources(): SourceSnapshot[] {
  return clone(golden.sources) as SourceSnapshot[];
}

export const weatherNow = Date.parse('2026-10-28T13:50:00Z');

export function weatherSource(id: 'weather' | 'weather-radar' | 'weather-alerts'): SourceSnapshot {
  return weatherSources().find((entry) => entry.id === id)!;
}

export function weatherSnapshot(overrides: { sources?: SourceSnapshot[] } = {}): Snapshot {
  return snapshotFixture({ sources: overrides.sources ?? weatherSources() });
}

const SIZE = 101;

function frameValues(step: number): string {
  const bytes = new Uint8Array(SIZE * SIZE);
  // a blob of rain that moves from west to east and grows in intensity
  const centreCol = 20 + step * 15;
  for (let row = 40; row < 60; row += 1) {
    for (let col = Math.max(0, centreCol - 8); col < Math.min(SIZE, centreCol + 8); col += 1) {
      bytes[row * SIZE + col] = 10 + step * 20;
    }
  }
  return btoa(String.fromCharCode(...bytes));
}

export function radarDocumentFixture(frameCount = 5): RadarDocument {
  return {
    version: '2026-10-28T13:40:00.000Z',
    size: SIZE,
    corners: [
      [12.73196, 52.98159],
      [12.66458, 52.10996],
      [14.07482, 52.0588],
      [14.17765, 52.92888],
    ],
    home: { col: 50, row: 50, lat: 52.52, lon: 13.405 },
    map: {
      zoom: 9,
      tileSize: 256,
      tiles: [274, 275, 276].flatMap((x) => [168, 169].map((y) => ({ x, y }))),
    },
    frames: Array.from({ length: frameCount }, (_, index) => ({
      time: new Date(Date.parse('2026-10-28T12:40:00Z') + index * 30 * 60_000).toISOString(),
      kind: index < 3 ? ('observed' as const) : ('forecast' as const),
      values: frameValues(index),
    })),
  };
}
