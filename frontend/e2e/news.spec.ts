import { expect, test } from '@playwright/test';
import { tileFitProblems } from './helpers';
import { activeTitle, newsInstant, newsTile, openNews, smallestFontIn } from './news-helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: newsInstant });
});

// Covers: FR-3, AC-5, AC-6, AC-10, AC-11, AC-13, AC-14
test.describe('news tile on the wall', () => {
  test('rotates the headlines with the fake clock, local first', async ({ page }) => {
    await openNews(page);
    expect(await activeTitle(page)).toBe('Pyrotechnik an Halloween in Berlin');
    await expect(newsTile(page).getByText('1 von 5')).toBeVisible();
    await page.clock.runFor(15_000);
    expect(await activeTitle(page)).toBe('Hennigsdorfer Havelbrücke auf halbem Weg');
    await page.clock.runFor(15_000);
    await page.clock.runFor(15_000);
    expect(await activeTitle(page)).toBe('Zehn Tage gegen den Krieg im Kopf');
    await expect(newsTile(page).getByText('Tagesschau')).toBeVisible();
    await expect(newsTile(page).getByText('Welt')).toBeVisible();
  });

  test('advances on a tap, pauses and resumes after a minute', async ({ page }) => {
    await openNews(page);
    await page.getByTestId('view-surface').click();
    expect(await activeTitle(page)).toBe('Hennigsdorfer Havelbrücke auf halbem Weg');
    await page.clock.runFor(45_000);
    expect(await activeTitle(page)).toBe('Hennigsdorfer Havelbrücke auf halbem Weg');
    await page.clock.runFor(30_000);
    expect(await activeTitle(page)).not.toBe('Hennigsdorfer Havelbrücke auf halbem Weg');
  });

  test('swipes with a mouse drag without scrolling the page', async ({ page }) => {
    await openNews(page);
    const box = (await page.getByTestId('view-surface').boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, y + 4, { steps: 6 });
    await page.mouse.up();
    expect(await activeTitle(page)).toBe('Hennigsdorfer Havelbrücke auf halbem Weg');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('has previous and next buttons of at least 56 px with German names', async ({ page }) => {
    await openNews(page);
    await page.waitForTimeout(1500); // let the tile entrance animation finish before measuring
    for (const name of ['Vorherige Schlagzeile', 'Nächste Schlagzeile']) {
      const box = (await newsTile(page).getByRole('button', { name }).boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
    }
    await newsTile(page).getByRole('button', { name: 'Nächste Schlagzeile' }).click();
    expect(await activeTitle(page)).toBe('Hennigsdorfer Havelbrücke auf halbem Weg');
  });

  test('shows source and age at 28 px or more and renders no link', async ({ page }) => {
    await openNews(page);
    await expect(newsTile(page).getByText('rbb24')).toBeVisible();
    await expect(newsTile(page).getByText('vor 12 Min.')).toBeVisible();
    expect(
      await smallestFontIn(page, 'section[aria-labelledby]:has([data-testid="view-surface"])'),
    ).toBeGreaterThanOrEqual(28);
    await expect(newsTile(page).locator('a')).toHaveCount(0);
  });
});

// Covers: AC-7
test.describe('news tile with reduced motion', () => {
  test('changes headlines with a fade of at most 150 ms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openNews(page);
    await page.getByTestId('view-surface').click();
    const duration = await page
      .locator('[data-headline-active="true"]')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration));
    expect(duration).toBeLessThanOrEqual(0.15);
  });
});

// Covers: AC-8, AC-23
test.describe('news tile fit', () => {
  const sizes = [
    { width: 1024, height: 750 },
    { width: 1180, height: 700 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1200 },
    { width: 2048, height: 1536 },
  ];

  for (const size of sizes) {
    test(`stays inside the tile at ${size.width} x ${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await openNews(page);
      await page.clock.runFor(30_000); // the 160-character headline is the third one
      await page.getByTestId('view-surface').click();
      await page.waitForTimeout(1500);
      expect(await tileFitProblems(page)).toEqual([]);
      await newsTile(page).screenshot({
        path: `e2e/screenshots/news-headlines/tile-${size.width}x${size.height}.png`,
      });
      expect(
        await smallestFontIn(page, 'section[aria-labelledby]:has([data-testid="view-surface"])'),
      ).toBeGreaterThanOrEqual(28);
    });
  }

  test('shows exactly one headline with source and age on a short screen', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 700 });
    await openNews(page);
    await expect(page.getByTestId('headline-title')).toHaveCount(1);
    await expect(newsTile(page).getByText('rbb24')).toBeVisible();
    await expect(newsTile(page).getByText('vor 12 Min.')).toBeVisible();
  });
});

// Covers: AC-17, AC-19, AC-20
test.describe('news tile states', () => {
  test('keeps the last headline visible when the backend becomes unreachable', async ({ page }) => {
    await openNews(page);
    await page.route('**/api/v1/snapshot', (route) => route.abort());
    await page.clock.runFor(130_000);
    await expect(newsTile(page).getByTestId('headline-title').first()).toBeVisible();
  });

  test('marks a stale source and keeps the fresh one rotating', async ({ page }) => {
    await openNews(page, { local: 'stale' });
    await expect(newsTile(page).getByText(/Veraltet · vor 50 Min\./)).toBeVisible();
    await page.clock.runFor(15_000 * 3);
    await expect(newsTile(page).getByText('Tagesschau')).toBeVisible();
  });

  test('shows the calm text when nothing was loaded yet', async ({ page }) => {
    await openNews(page, { local: 'never-loaded', global: 'never-loaded' });
    await expect(newsTile(page).getByText('Schlagzeilen noch nicht geladen')).toBeVisible();
  });
});

// Covers: AC-21, AC-22
test.describe('news list on the phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('lists the headlines grouped without horizontal scrolling', async ({ page }) => {
    await openNews(page);
    await expect(newsTile(page).getByRole('heading', { name: 'Regional' })).toBeVisible();
    await expect(newsTile(page).getByRole('heading', { name: 'Welt' })).toBeVisible();
    await expect(newsTile(page).getByText('Koalitionsverhandlungen beginnen')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const rows = await newsTile(page).locator('li').all();
    expect(rows.length).toBe(5);
    for (const row of rows) {
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
