import { expect, test, type Page } from '@playwright/test';
import { demoSource, mockSnapshot, screenshotDir, snapshotBody, tileFitProblems } from './helpers';

// The demo source replaces the news placeholder, so its tile can show every state.
const demoTile = (page: Page) => page.getByRole('region', { name: 'Demo' });

const scenarios = [
  ['fresh', demoSource(), 'fresh'],
  ['stale', demoSource({ status: 'stale', ageSeconds: 300 }), 'stale'],
  [
    'error',
    demoSource({
      status: 'error',
      data: null,
      ageSeconds: null,
      lastUpdated: null,
      lastErrorCode: 'SOURCE_FETCH_FAILED',
    }),
    'error',
  ],
  [
    'never-loaded',
    demoSource({ status: 'never-loaded', data: null, ageSeconds: null, lastUpdated: null }),
    'never-loaded',
  ],
  ['empty', demoSource({ data: null }), 'empty'],
] as const;

// Covers: F-3, FR-5, AC-9, AC-12, AC-36
test.describe('tile states', () => {
  for (const [name, source, status] of scenarios) {
    test(`shows the ${name} state with readable content`, async ({ page }) => {
      await mockSnapshot(page, snapshotBody({ sources: [source] }));
      await page.goto('/');
      await expect(demoTile(page)).toHaveAttribute('data-status', status);
      const text = (await demoTile(page).innerText()).trim();
      expect(text.length).toBeGreaterThan('Demo'.length);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${screenshotDir}/state-${name}.png` });
    });
  }

  for (const size of [
    { width: 1024, height: 750 },
    { width: 1180, height: 700 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
  ]) {
    test(`fits every state inside its card at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const [, source] of scenarios) {
        await mockSnapshot(page, snapshotBody({ sources: [source] }));
        await page.goto('/');
        await expect(demoTile(page)).toBeVisible();
        await page.waitForTimeout(1300);
        expect(
          await tileFitProblems(page),
          `${source.status} ${JSON.stringify(source.data)}`,
        ).toEqual([]);
      }
    });
  }

  test('shows the loading state before the first snapshot arrives', async ({ page }) => {
    await page.route('**/api/v1/snapshot', () => new Promise(() => {}));
    await page.goto('/');
    await expect(page.getByRole('region').first()).toHaveAttribute('data-status', 'fresh'); // placeholder tiles
    await expect(page.getByRole('region', { name: 'Demo' })).toHaveCount(0);
  });

  test('shows stale content and the offline indication together while the poll fails', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-28T10:15:00Z') });
    let fail = false;
    await page.route('**/api/v1/snapshot', (route) =>
      fail
        ? route.abort()
        : route.fulfill({ json: snapshotBody({ sources: [demoSource({ ageSeconds: 100 })] }) }),
    );
    await page.goto('/');
    await expect(demoTile(page)).toHaveAttribute('data-status', 'fresh');
    fail = true;
    await page.clock.runFor(30_000);
    await page.clock.runFor(30_000);
    await page.clock.runFor(30_000);
    await expect(page.getByRole('status')).toContainText('Keine Verbindung');
    await expect(demoTile(page)).toHaveAttribute('data-status', 'stale');
    await expect(demoTile(page)).toContainText('42');
    await expect(demoTile(page)).toContainText('Veraltet');
    await page.screenshot({ path: `${screenshotDir}/stale-and-offline.png` });
  });
});
