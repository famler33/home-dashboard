import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

interface Source {
  id: string;
  status: string;
  data: unknown;
  lastUpdated: string | null;
  ageSeconds: number | null;
  staleAfterSeconds: number;
  lastErrorCode: string | null;
}

const golden = JSON.parse(
  readFileSync(
    join(process.cwd(), '../backend/test/fixtures/weather.snapshot.sample.json'),
    'utf8',
  ),
) as { sources: Source[] };

/** The golden snapshot was recorded around this instant; the Playwright clock is set to it. */
export const weatherInstant = new Date('2026-10-28T13:50:00Z');

export const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const SIZE = 101;
const corners = [
  [12.73196, 52.98159],
  [12.66458, 52.10996],
  [14.07482, 52.0588],
  [14.17765, 52.92888],
];

function tiles(): { x: number; y: number }[] {
  const n = 2 ** 9;
  const points = corners.map(([lon, lat]) => {
    const rad = (lat! * Math.PI) / 180;
    return {
      x: Math.floor(((lon! + 180) / 360) * n),
      y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
    };
  });
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const out: { x: number; y: number }[] = [];
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1) out.push({ x, y });
  }
  return out;
}

function frame(step: number): string {
  const bytes = Buffer.alloc(SIZE * SIZE);
  const centre = 15 + step * 18;
  for (let row = 35; row < 65; row += 1) {
    for (let col = Math.max(0, centre - 10); col < Math.min(SIZE, centre + 10); col += 1) {
      bytes[row * SIZE + col] = 12 + step * 25;
    }
  }
  return bytes.toString('base64');
}

export function radarDocument(frames = 5) {
  return {
    version: '2026-10-28T13:40:00.000Z',
    size: SIZE,
    corners,
    home: { col: 50, row: 50, lat: 52.52, lon: 13.405 },
    map: { zoom: 9, tileSize: 256, tiles: tiles() },
    frames: Array.from({ length: frames }, (_, index) => ({
      time: new Date(Date.parse('2026-10-28T12:40:00Z') + index * 30 * 60_000).toISOString(),
      kind: index < 3 ? 'observed' : 'forecast',
      values: frame(index),
    })),
  };
}

export interface WeatherMock {
  alerts?: { id: string; type: string; severity: string; onset: string; expires: string }[];
  alertsStatus?: string;
  weatherStatus?: string;
  radarStatus?: string;
  radarStatusCode?: number;
  rain?: number[];
}

export function weatherSnapshotBody(options: WeatherMock = {}) {
  const sources = JSON.parse(JSON.stringify(golden.sources)) as Source[];
  const entry = (id: string) => sources.find((source) => source.id === id)!;
  if (options.alerts)
    (entry('weather-alerts').data as { alerts: unknown[] }).alerts = options.alerts;
  if (options.alertsStatus) entry('weather-alerts').status = options.alertsStatus;
  if (options.weatherStatus) {
    entry('weather').status = options.weatherStatus;
    if (options.weatherStatus === 'stale') entry('weather').ageSeconds = 4_000;
  }
  if (options.radarStatus) entry('weather-radar').status = options.radarStatus;
  if (options.rain) {
    (entry('weather').data as { rainSeries: { time: string; mmPerHour: number }[] }).rainSeries =
      options.rain.map((mmPerHour, index) => ({
        time: new Date(weatherInstant.getTime() + index * 15 * 60_000).toISOString(),
        mmPerHour,
      }));
  }
  return {
    buildId: 'e2e',
    serverTime: weatherInstant.toISOString(),
    settings: {
      timezone: 'Europe/Berlin',
      display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
    },
    sources,
  };
}

/** Mocks the snapshot, the radar document and the basemap tiles; every request is recorded in `requests`. */
export async function mockWeather(
  page: Page,
  options: WeatherMock = {},
): Promise<{ requests: string[] }> {
  const requests: string[] = [];
  await page.route('**/api/v1/snapshot', (route) =>
    route.fulfill({ json: weatherSnapshotBody(options) }),
  );
  await page.route('**/api/v1/weather/radar', (route) => {
    requests.push('radar');
    if (options.radarStatusCode && options.radarStatusCode !== 200) {
      return route.fulfill({
        status: options.radarStatusCode,
        json: { error: { code: 'RADAR_NOT_AVAILABLE', message: 'x', details: null } },
      });
    }
    return route.fulfill({ json: radarDocument() });
  });
  await page.route('**/api/v1/weather/basemap/**', (route) => {
    requests.push('tile');
    return route.fulfill({ body: tinyPng, contentType: 'image/png' });
  });
  return { requests };
}

export const activeView = (page: Page) =>
  page.locator('[data-view-active="true"]').getAttribute('data-view');

export async function goToView(
  page: Page,
  name: 'Jetzt' | '7 Tage' | 'Regen und Radar',
): Promise<void> {
  await page.getByRole('tab', { name }).click();
}
