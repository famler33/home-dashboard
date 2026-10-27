import type { Page, Route } from '@playwright/test';

export interface SourceBody {
  id: string;
  status: 'never-loaded' | 'fresh' | 'stale' | 'error';
  data: unknown;
  lastUpdated: string | null;
  ageSeconds: number | null;
  staleAfterSeconds: number;
  lastErrorCode: 'SOURCE_FETCH_FAILED' | 'SOURCE_TIMEOUT' | null;
}

export function snapshotBody(overrides: { buildId?: string; sources?: SourceBody[] } = {}) {
  return {
    buildId: overrides.buildId ?? 'e2e',
    serverTime: '2026-10-28T10:15:00.000Z',
    settings: {
      timezone: 'Europe/Berlin',
      display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
    },
    sources: overrides.sources ?? [],
  };
}

export const demoSource = (overrides: Partial<SourceBody> = {}): SourceBody => ({
  id: 'demo',
  status: 'fresh',
  data: { value: 42 },
  lastUpdated: '2026-10-28T10:14:30.000Z',
  ageSeconds: 30,
  staleAfterSeconds: 120,
  lastErrorCode: null,
  ...overrides,
});

/** Serve a fixed snapshot for every poll. */
export async function mockSnapshot(page: Page, body = snapshotBody()): Promise<void> {
  await page.route('**/api/v1/snapshot', (route: Route) => route.fulfill({ json: body }));
}

export const screenshotDir = 'e2e/screenshots/dashboard-foundation';

/** Smallest font size of any rendered text in the document. */
export async function smallestFontSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    let smallest = Number.POSITIVE_INFINITY;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const element = node.parentElement;
      if (!element) continue;
      smallest = Math.min(smallest, Number.parseFloat(getComputedStyle(element).fontSize));
    }
    return smallest;
  });
}
