import { expect, test } from '@playwright/test';
import {
  mockSnapshot,
  screenshotDir,
  smallestFontSize,
  snapshotBody,
  tileFitProblems,
} from './helpers';

// CSS pixel sizes: a physical 2048x1536 iPad reports 1024x768, a 10" Android tablet 1280x800.
const tabletViewports = [
  { width: 1920, height: 1200, label: '16x10' },
  { width: 2048, height: 1536, label: '4x3' },
  { width: 1280, height: 800, label: '16x10-small' },
  { width: 1024, height: 768, label: '4x3-ipad-css' },
  { width: 1180, height: 820, label: 'ipad-air-css' },
  { width: 1280, height: 720, label: '16x9' },
  { width: 1024, height: 750, label: 'smallest-tablet' },
  { width: 1180, height: 700, label: 'low-wide-tablet' },
];

// Covers: FR-1, FR-3, NFR-8, AC-1, AC-2, AC-37
for (const viewport of tabletViewports) {
  test.describe(`tablet ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async ({ page }) => {
      await mockSnapshot(page);
      await page.goto('/');
      await expect(page.getByRole('region')).toHaveCount(4);
      await page.waitForTimeout(1500); // let the entrance animation finish
    });

    test('has no scrolling and shows the clock, the date and four tiles', async ({ page }) => {
      const overflow = await page.evaluate(() => ({
        v: document.documentElement.scrollHeight - window.innerHeight,
        h: document.documentElement.scrollWidth - window.innerWidth,
      }));
      expect(overflow.v).toBeLessThanOrEqual(0);
      expect(overflow.h).toBeLessThanOrEqual(0);
      await expect(page.locator('time')).toBeVisible();
      await expect(page.getByRole('heading', { level: 2 })).toHaveCount(4);
      await page.screenshot({ path: `${screenshotDir}/shell-${viewport.label}.png` });
    });

    test('keeps tile boxes inside the viewport and non-overlapping', async ({ page }) => {
      const boxes = await page.getByRole('region').evaluateAll((nodes) =>
        nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }),
      );
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.bottom).toBeLessThanOrEqual(viewport.height + 1);
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const overlaps =
            a.left < b.right - 1 &&
            b.left < a.right - 1 &&
            a.top < b.bottom - 1 &&
            b.top < a.bottom - 1;
          expect(overlaps, `tiles ${i} and ${j}`).toBe(false);
        }
      }
    });

    test('fits every tile content inside its card without clipping or overlap', async ({
      page,
    }) => {
      expect(await tileFitProblems(page)).toEqual([]);
    });

    test('has no text node below 28px', async ({ page }) => {
      expect(await smallestFontSize(page)).toBeGreaterThanOrEqual(28);
    });
  });
}

// Covers: FR-14, AC-20, AC-37
test.describe('small landscape screens', () => {
  test.use({ viewport: { width: 960, height: 600 } });

  test('fall back to the scrollable phone layout without horizontal scrolling', async ({
    page,
  }) => {
    await mockSnapshot(page);
    await page.goto('/');
    await expect(page.getByRole('region')).toHaveCount(4);
    await expect(page.getByTestId('drift-wrapper')).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

// Covers: NFR-5, NFR-6, AC-43
test.describe('transport and access', () => {
  test('loads the dashboard without any login prompt', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('time')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('makes no off-origin requests and triggers no CSP violation', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const foreign: string[] = [];
    const messages: string[] = [];
    page.on('request', (request) => {
      if (!request.url().startsWith(origin) && !request.url().startsWith('data:'))
        foreign.push(request.url());
    });
    page.on('console', (message) => messages.push(message.text()));
    await page.clock.install({ time: new Date('2026-10-28T14:04:50Z') });
    await mockSnapshot(page, snapshotBody());
    await page.goto('/');
    await page.waitForTimeout(1500);
    // Let the clock digits roll and the drift step so animation code paths run under the CSP.
    await page.clock.runFor(15_000);
    await page.clock.runFor(5 * 60_000);
    expect(foreign).toEqual([]);
    expect(messages.filter((text) => /content security policy/i.test(text))).toEqual([]);
  });

  // Covers: NFR-5, AC-27
  test('contains no credential strings in the delivered bundle', async ({ request }) => {
    const index = await (await request.get('/')).text();
    const assets = [...index.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(
      (match) => match[1]!,
    );
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      const body = await (await request.get(asset)).text();
      for (const forbidden of ['credentials.yaml', 'CHANGE_ME', 'apiKey', 'S3CR3T']) {
        expect(body.includes(forbidden), `${asset} contains ${forbidden}`).toBe(false);
      }
    }
  });

  test('sends the security headers from the real server', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers()['cache-control']).toBe('no-cache');
    const api = await request.get('/api/v1/snapshot');
    expect(api.headers()['cache-control']).toBe('no-store');
  });
});
