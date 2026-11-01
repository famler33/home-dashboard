import { expect, test } from '@playwright/test';
import { tileFitProblems, screenshotDir } from './helpers';
import { activeView, goToView, mockWeather, weatherInstant } from './weather-helpers';

const alert = {
  id: 'a',
  type: 'Gewitter',
  severity: 'severe',
  onset: '2026-10-28T12:00:00.000Z',
  expires: '2026-10-28T20:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: weatherInstant });
});

// Covers: FR-9, AC-22, AC-23, AC-24, AC-25, AC-44, AC-45, AC-46
test.describe('weather views on the wall', () => {
  test('rotates through the three views with the fake clock', async ({ page }) => {
    await mockWeather(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Wetter · Zuhause' })).toBeVisible();
    expect(await activeView(page)).toBe('now');
    await page.clock.runFor(15_000);
    expect(await activeView(page)).toBe('days');
    await page.clock.runFor(15_000);
    expect(await activeView(page)).toBe('rain');
    await page.clock.runFor(15_000);
    expect(await activeView(page)).toBe('now');
  });

  test('advances on a tap and resumes after a minute', async ({ page }) => {
    await mockWeather(page);
    await page.goto('/');
    await page.getByTestId('view-surface').click();
    expect(await activeView(page)).toBe('days');
    await page.clock.runFor(45_000);
    expect(await activeView(page)).toBe('days');
    await page.clock.runFor(30_000);
    expect(await activeView(page)).not.toBe('days');
  });

  test('switches views with a mouse drag and does not scroll the page', async ({ page }) => {
    await mockWeather(page);
    await page.goto('/');
    const box = (await page.getByTestId('view-surface').boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.8, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, y + 4, { steps: 6 });
    await page.mouse.up();
    expect(await activeView(page)).toBe('days');
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, y + 4, { steps: 6 });
    await page.mouse.up();
    expect(await activeView(page)).toBe('now');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('jumps with the indicators, which are at least 56px and have German names', async ({
    page,
  }) => {
    await mockWeather(page);
    await page.goto('/');
    await page.waitForTimeout(1500); // let the tile entrance animation (scale) finish before measuring
    for (const tab of await page.getByRole('tab').all()) {
      const box = (await tab.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
    }
    await goToView(page, 'Regen und Radar');
    expect(await activeView(page)).toBe('rain');
    await expect(page.getByRole('tab', { name: 'Regen und Radar' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('uses a transition of at most 150 ms with reducedMotion=reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockWeather(page);
    await page.goto('/');
    await page.getByTestId('view-surface').click();
    const durations = await page
      .locator('[data-view]')
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationDuration));
    for (const duration of durations)
      expect(
        Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000),
      ).toBeLessThanOrEqual(150);
  });

  test('stops rotating while the weather values are stale', async ({ page }) => {
    await mockWeather(page, { weatherStatus: 'stale' });
    await page.goto('/');
    await page.clock.runFor(60_000);
    expect(await activeView(page)).toBe('now');
    await expect(page.getByText('Veraltet')).toBeVisible();
  });
});

// Covers: FR-1, FR-4, FR-5, FR-6, AC-1, AC-6, AC-7, AC-9, AC-14
test.describe('weather content', () => {
  test('shows temperature, five hourly slots and the rain line in the now view', async ({
    page,
  }) => {
    await mockWeather(page);
    await page.goto('/');
    await expect(page.getByTestId('hour-slot')).toHaveCount(5);
    await expect(page.getByTestId('rain-line')).toContainText(
      'Kein Regen in den nächsten 2 Stunden',
    );
    await expect(page.getByText(/Heute \d+° \/ \d+°/)).toBeVisible();
  });

  test('describes the next rain from the forecast series when the radar is stale', async ({
    page,
  }) => {
    await mockWeather(page, {
      radarStatus: 'stale',
      rain: [0, 0, 1, 1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    await page.goto('/');
    await expect(page.getByTestId('rain-line')).toContainText('Regen ab 15:20, ca. 45 Min.');
  });

  test('shows the symbols of the hourly slots on tall screens and hides them visually on short ones', async ({
    page,
  }) => {
    await mockWeather(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    const tall = await page.getByTestId('hour-slot').first().locator('svg').boundingBox();
    expect(tall!.width).toBeGreaterThan(10);
    await page.setViewportSize({ width: 1280, height: 800 });
    const wrapper = page
      .getByTestId('hour-slot')
      .first()
      .locator('[class*="tablet-short:sr-only"]');
    expect((await wrapper.boundingBox())?.width ?? 0).toBeLessThanOrEqual(2);
  });

  test('shows seven days on the wall', async ({ page }) => {
    await mockWeather(page);
    await page.goto('/');
    await goToView(page, '7 Tage');
    await expect(page.getByTestId('day')).toHaveCount(7);
    await expect(page.getByTestId('day').first()).toContainText('Heute');
  });
});

// Covers: FR-7, FR-8, AC-16, AC-17, AC-19, AC-20, AC-21
test.describe('rain radar', () => {
  test('shows the radar canvas with a moving loop and a home marker', async ({ page }) => {
    const { requests } = await mockWeather(page);
    await page.goto('/');
    await goToView(page, 'Regen und Radar');
    const canvas = page
      .getByRole('img', { name: 'Regenradar der Umgebung' })
      .locator('canvas')
      .nth(1);
    await expect(canvas).toBeVisible();
    await page.clock.runFor(100);
    const first = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    await page.clock.runFor(1_000);
    const second = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    expect(second).not.toBe(first);
    expect(requests).toContain('radar');
    expect(requests).toContain('tile');
    await expect(page.getByTestId('frame-label')).toContainText(/Uhr · (Beobachtung|Vorhersage)/);
    await expect(page.getByText('Radar: Deutscher Wetterdienst')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/weather-radar.png` });
  });

  test('does not load the radar document while another view is shown', async ({ page }) => {
    const { requests } = await mockWeather(page);
    await page.goto('/');
    await page.clock.runFor(5_000);
    expect(requests).not.toContain('radar');
  });

  test('shows the unavailable state while the rain statement remains', async ({ page }) => {
    await mockWeather(page, { radarStatusCode: 404, radarStatus: 'error' });
    await page.goto('/');
    await goToView(page, 'Regen und Radar');
    await expect(page.getByText('Radar derzeit nicht verfügbar')).toBeVisible();
    await expect(page.getByTestId('rain-statement')).toContainText('Kein Regen');
  });

  test('does not animate the radar with reducedMotion=reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockWeather(page);
    await page.goto('/');
    await goToView(page, 'Regen und Radar');
    const canvas = page
      .getByRole('img', { name: 'Regenradar der Umgebung' })
      .locator('canvas')
      .nth(1);
    await expect(canvas).toBeVisible();
    await page.clock.runFor(100);
    const first = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    await page.clock.runFor(3_000);
    expect(await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL())).toBe(first);
  });
});

// Covers: FR-11, AC-31, AC-34, AC-35
test.describe('weather warnings', () => {
  test('keeps the warning banner visible in every wall view', async ({ page }) => {
    await mockWeather(page, { alerts: [alert] });
    await page.goto('/');
    for (const view of ['Jetzt', '7 Tage', 'Regen und Radar'] as const) {
      await goToView(page, view);
      await expect(page.getByRole('group', { name: 'Wetterwarnung' })).toContainText(
        'Unwetterwarnung',
      );
    }
  });

  test('leaves the weather layout unchanged without a warning', async ({ page }) => {
    await mockWeather(page, { alerts: [] });
    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Wetterwarnung' })).toHaveCount(0);
    const none = await page.getByTestId('view-surface').boundingBox();
    expect(none!.height).toBeGreaterThan(60);
  });

  test('says that warnings cannot be checked when the alert data is stale', async ({ page }) => {
    await mockWeather(page, { alertsStatus: 'stale' });
    await page.goto('/');
    await expect(page.getByText('Warnungen nicht prüfbar')).toBeVisible();
  });
});

// Covers: FR-17, NFR-7, AC-40, AC-41
const sizes = [
  { width: 1024, height: 750 },
  { width: 1180, height: 700 },
  { width: 1280, height: 720 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 1920, height: 1200 },
  { width: 2048, height: 1536 },
];
for (const size of sizes) {
  test.describe(`fit at ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    for (const withAlert of [true, false]) {
      test(`keeps every view inside the weather card ${withAlert ? 'with' : 'without'} a warning`, async ({
        page,
      }) => {
        await mockWeather(page, withAlert ? { alerts: [alert] } : { alerts: [] });
        await page.goto('/');
        await page.waitForTimeout(1_300); // tile entrance animation runs in real time
        for (const view of ['Jetzt', '7 Tage', 'Regen und Radar'] as const) {
          await goToView(page, view);
          await page.clock.runFor(1_500); // finish the fade and let the radar draw
          await page.waitForTimeout(700); // CSS fade runs in real time
          await page.screenshot({
            path: `${screenshotDir}/weather-${size.width}x${size.height}-${view.replace(/ /g, '-')}${withAlert ? '-warn' : ''}.png`,
          });
          const problems = await tileFitProblems(page);
          expect(problems, `${view}: ${problems.join(' | ')}`).toEqual([]);
        }
      });
    }

    test('has no weather text below 28px', async ({ page }) => {
      await mockWeather(page, { alerts: [alert] });
      await page.goto('/');
      const smallest = await page.getByRole('region', { name: /Wetter/ }).evaluate((root) => {
        let min = Number.POSITIVE_INFINITY;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) continue;
          const element = node.parentElement!;
          if (element.closest('.sr-only') || element.closest('[class*="sr-only"]')) continue;
          const size = Number.parseFloat(getComputedStyle(element).fontSize);
          if (Number.isFinite(size)) min = Math.min(min, size);
        }
        return min;
      });
      expect(smallest).toBeGreaterThanOrEqual(28);
    });
  });
}

// Covers: AC-29, AC-30
test.describe('symbol motion', () => {
  test('animates symbols only with transform and opacity at durations of at least 6 seconds', async ({
    page,
  }) => {
    await mockWeather(page);
    await page.goto('/');
    await expect(page.getByTestId('hour-slot').first()).toBeVisible();
    const names = await page.locator('[class*="symbol-"]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        name: getComputedStyle(node).animationName,
        duration: getComputedStyle(node).animationDuration,
      })),
    );
    expect(names.length).toBeGreaterThan(0);
    for (const { name, duration } of names) {
      expect(name).toMatch(/^symbol-/);
      expect(Number.parseFloat(duration)).toBeGreaterThanOrEqual(6);
    }
    const properties = await page.evaluate(() => {
      const found = new Set<string>();
      for (const sheet of Array.from(document.styleSheets)) {
        const scan = (rule: CSSRule) => {
          if (rule instanceof CSSKeyframesRule && rule.name.startsWith('symbol-')) {
            for (const frame of Array.from(rule.cssRules) as CSSKeyframeRule[])
              for (let i = 0; i < frame.style.length; i += 1) found.add(frame.style[i]!);
          }
          if ('cssRules' in rule)
            for (const child of Array.from((rule as CSSGroupingRule).cssRules)) scan(child);
        };
        for (const rule of Array.from(sheet.cssRules)) scan(rule);
      }
      return [...found].sort();
    });
    expect(properties).toEqual(['opacity', 'transform']);
  });

  test('has no running symbol animation with reducedMotion=reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockWeather(page);
    await page.goto('/');
    const names = await page
      .locator('[class*="symbol-"]')
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
    for (const name of names) expect(name).toBe('none');
  });
});

// Covers: NFR-4, FR-9
test('makes no request to any other origin while the weather tile runs', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  const csp: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:'))
      foreign.push(request.url());
  });
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) csp.push(message.text());
  });
  await mockWeather(page, { alerts: [alert] });
  await page.goto('/');
  await page.clock.runFor(50_000);
  expect(foreign).toEqual([]);
  expect(csp).toEqual([]);
});

// Covers: FR-14, AC-8, AC-11, AC-20, AC-26, AC-40, AC-42
test.describe('weather on the phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('shows all views in one section without horizontal scrolling and with the full credit', async ({
    page,
  }) => {
    await mockWeather(page);
    await page.goto('/');
    await expect(page.getByTestId('hour-slot')).toHaveCount(24);
    await expect(page.getByTestId('day')).toHaveCount(7);
    await expect(page.getByTestId('rain-statement')).toBeVisible();
    await expect(
      page.getByText('Wetter: Open-Meteo.com (CC BY 4.0)', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const sizes = await page
      .locator('button, a[href], input, select, textarea, [role="button"]')
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          Math.min(node.getBoundingClientRect().width, node.getBoundingClientRect().height),
        ),
      );
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${screenshotDir}/weather-phone.png`, fullPage: true });
  });
});
