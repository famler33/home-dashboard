import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { calendarSnapshotBody } from './calendar-helpers';
import { radarDocument, tinyPng, weatherInstant, weatherSnapshotBody } from './weather-helpers';

// Generates the README screenshot from the recorded sample data (no real household data).
// Not part of the regular suite: run it with
//   SCREENSHOT=1 pnpm exec playwright test e2e/screenshot.spec.ts
test.skip(process.env['SCREENSHOT'] !== '1', 'only runs on demand to refresh docs/screenshot.png');

const sample = (file: string) =>
  JSON.parse(readFileSync(join(process.cwd(), '../backend/test/fixtures', file), 'utf8')) as {
    sources: unknown[];
  };

const minutesAgo = (minutes: number) =>
  new Date(weatherInstant.getTime() - minutes * 60_000).toISOString();

function newsSource(group: 'local' | 'global', titles: string[]) {
  return {
    id: `news-${group}`,
    status: 'fresh',
    data: {
      group,
      sourceName: group === 'local' ? 'rbb24' : 'Tagesschau',
      headlines: titles.map((title, index) => ({
        id: `${group}-${index}`,
        title,
        publishedAt: minutesAgo(10 + index * 35),
      })),
    },
    lastUpdated: minutesAgo(1),
    ageSeconds: 60,
    staleAfterSeconds: 2700,
    lastErrorCode: null,
  };
}

test('renders the full dashboard with sample data for the README', async ({ page }) => {
  const weather = weatherSnapshotBody();
  const calendar = calendarSnapshotBody();
  const body = {
    buildId: 'e2e',
    serverTime: weatherInstant.toISOString(),
    settings: calendar.settings,
    sources: [
      ...weather.sources,
      ...calendar.sources,
      ...sample('lists/lists.snapshot.sample.json').sources,
      newsSource('local', [
        'Neue Radwege in der Innenstadt eröffnet',
        'Sperrung der Stadtbahn am Wochenende',
        'Stadtfest zieht tausende Besucher an',
      ]),
      newsSource('global', [
        'Klimagipfel einigt sich auf Abschlusserklärung',
        'Neue Studie zu Schlaf und Gesundheit',
      ]),
    ],
  };

  await page.clock.install({ time: weatherInstant });
  await page.route('**/api/v1/snapshot', (route) => route.fulfill({ json: body }));
  await page.route('**/api/v1/weather/radar', (route) => route.fulfill({ json: radarDocument() }));
  await page.route('**/api/v1/weather/basemap/**', (route) =>
    route.fulfill({ body: tinyPng, contentType: 'image/png' }),
  );
  const listsState = JSON.parse(
    readFileSync(
      join(process.cwd(), '../backend/test/fixtures/lists/lists.state.sample.json'),
      'utf8',
    ),
  ) as unknown;
  await page.route('**/api/v1/lists', (route) => route.fulfill({ json: listsState }));

  await page.goto('/');
  for (const name of ['Wetter', 'Kalender', 'Einkaufsliste & To-dos', 'Nachrichten']) {
    await expect(page.getByRole('region', { name })).toBeVisible();
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '../docs/screenshot.png' });
});
