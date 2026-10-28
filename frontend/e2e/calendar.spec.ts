import { expect, test, type Page } from '@playwright/test';
import {
  calendarInstant,
  calendarSnapshotBody,
  ev,
  worstCase,
  type CalendarMock,
} from './calendar-helpers';
import { tileFitProblems } from './helpers';

async function open(page: Page, mock: CalendarMock = {}) {
  await page.route('**/api/v1/snapshot', (route) =>
    route.fulfill({ json: calendarSnapshotBody(mock) }),
  );
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Kalender' })).toBeVisible();
}

const tile = (page: Page) => page.getByRole('region', { name: 'Kalender' });

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: calendarInstant });
});

// Covers: FR-1, FR-4, FR-6, AC-1, AC-11, AC-17, AC-18, AC-19, AC-22, AC-23
test.describe('calendar tile on the wall', () => {
  test('shows the combined agenda with day headings and the Kita block', async ({ page }) => {
    await open(page);
    await expect(tile(page).getByTestId('day-heading').first()).toHaveText('Heute');
    await page.waitForTimeout(500);
    await expect(tile(page).getByTestId('kita-block')).toBeVisible();
    await expect(tile(page).getByRole('tablist')).toBeVisible();
    expect(await tile(page).getByTestId('event-row').count()).toBeGreaterThan(3);
  });

  test('switches between the tabs and returns to Alle after a minute', async ({ page }) => {
    await open(page);
    await tile(page).getByRole('tab', { name: 'Alex' }).click();
    await expect(tile(page).getByRole('tab', { name: 'Alex' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(tile(page).getByTestId('kita-block')).toHaveCount(0);
    await page.clock.runFor(61_000);
    await expect(tile(page).getByRole('tab', { name: 'Alle' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(tile(page).getByTestId('kita-block')).toBeVisible();
  });

  test('removes an ended event when the snapshot clock passes its end', async ({ page }) => {
    const events = { 'calendar-family': [ev('Kurz', '2026-10-28T10:00', '2026-10-28T10:30')] };
    await open(page, { events });
    await expect(tile(page).getByText('Kurz')).toBeVisible();
    await page.unroute('**/api/v1/snapshot');
    await page.route('**/api/v1/snapshot', (route) =>
      route.fulfill({
        json: calendarSnapshotBody({ events, serverTime: '2026-10-28T10:40:00.000Z' }),
      }),
    );
    await page.clock.runFor(31_000);
    await expect(tile(page).getByText('Kurz')).toHaveCount(0);
  });

  test('leaves the agenda layout unchanged without a Kita event', async ({ page }) => {
    await open(page, {
      events: { 'calendar-family': [ev('Zahnarzt', '2026-10-28T12:00', '2026-10-28T13:00')] },
    });
    await expect(tile(page).getByTestId('kita-block')).toHaveCount(0);
    await expect(tile(page).getByText('Zahnarzt')).toBeVisible();
  });

  test('says Heute keine Termine and omits empty days', async ({ page }) => {
    await open(page, {
      events: {
        'calendar-family': [ev('Freitag', '2026-10-30T10:00', '2026-10-30T11:00')],
        'calendar-person-1': [],
      },
    });
    await expect(tile(page).getByText('Heute keine Termine')).toBeVisible();
    await expect(tile(page).getByTestId('day-heading')).toHaveCount(2);
  });
});

// Covers: FR-8, AC-31, AC-33
test.describe('calendar tile states', () => {
  test('shows one stale calendar without hiding the others', async ({ page }) => {
    await open(page, { status: { 'calendar-person-1': 'stale' } });
    await expect(tile(page).getByTestId('legend')).toContainText('Veraltet · vor 40 Min.');
    await expect(tile(page).getByTestId('kita-block')).toBeVisible();
  });

  test('shows the error state when all calendars fail', async ({ page }) => {
    await open(page, { status: { 'calendar-family': 'error', 'calendar-person-1': 'error' } });
    await expect(tile(page)).toHaveAttribute('data-status', 'error');
    await expect(tile(page)).toContainText('Kalender derzeit nicht verfügbar');
  });
});

// Covers: NFR-2, NFR-4, NFR-6, AC-6, AC-16, AC-17, AC-20
test.describe('calendar tile layout', () => {
  for (const size of [
    { width: 1024, height: 750 },
    { width: 1180, height: 700 },
    { width: 1280, height: 720 },
    { width: 1280, height: 800 },
    { width: 1920, height: 1080 },
    { width: 2048, height: 1536 },
  ]) {
    test(`keeps the worst case inside the card at ${size.width}x${size.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await open(page, worstCase());
      await page.waitForTimeout(1200);
      expect(await tileFitProblems(page)).toEqual([]);
      await expect(tile(page).getByText(/weitere/)).toBeVisible();
    });
  }

  test('has no text below 28px in the calendar tile on the wall', async ({ page }) => {
    await open(page, worstCase());
    const small = await tile(page).evaluate((section) =>
      Array.from(section.querySelectorAll('*'))
        .filter((element) => !element.closest('.sr-only, [class*="sr-only"]'))
        .filter(
          (element) => (element.textContent ?? '').trim() !== '' && element.children.length === 0,
        )
        .map((element) => ({
          text: (element.textContent ?? '').slice(0, 20),
          size: parseFloat(getComputedStyle(element).fontSize),
        }))
        .filter((entry) => entry.size < 27.9),
    );
    expect(small).toEqual([]);
  });

  test('has tabs of at least 56px on the wall', async ({ page }) => {
    await open(page);
    await page.waitForTimeout(1200);
    for (const box of await tile(page)
      .getByRole('tab')
      .evaluateAll((tabs) => tabs.map((t) => t.getBoundingClientRect().height))) {
      expect(box).toBeGreaterThanOrEqual(55.5);
    }
  });

  test('uses a transition of at most 150 ms with reducedMotion=reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const duration = await tile(page)
      .getByTestId('agenda-body')
      .evaluate((node) => getComputedStyle(node).animationDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.15);
  });

  test('makes no request to any other origin while the calendar tile runs', async ({ page }) => {
    const foreign: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname)) foreign.push(url.hostname);
    });
    await open(page);
    await page.clock.runFor(60_000);
    expect(foreign).toEqual([]);
  });
});

// Covers: AC-35, AC-36, AC-37
test.describe('calendar tile on the phone', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('shows all days and tabs without horizontal scrolling and with tabs of at least 44px', async ({
    page,
  }) => {
    await open(page, worstCase());
    await page.waitForTimeout(1200);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(tile(page).getByText(/weitere/)).toHaveCount(0);
    for (const height of await tile(page)
      .getByRole('tab')
      .evaluateAll((tabs) => tabs.map((t) => t.getBoundingClientRect().height))) {
      expect(height).toBeGreaterThanOrEqual(43.5);
    }
  });

  test('keeps the selected tab after a minute', async ({ page }) => {
    await open(page);
    await tile(page).getByRole('tab', { name: 'Alex' }).click();
    await page.clock.runFor(120_000);
    await expect(tile(page).getByRole('tab', { name: 'Alex' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
