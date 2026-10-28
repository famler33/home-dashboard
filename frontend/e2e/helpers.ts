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

/** Problems where tile content is clipped, leaves its card or overlaps the card heading. */
export async function tileFitProblems(page: Page): Promise<string[]> {
  return page.getByRole('region').evaluateAll((sections) => {
    const found: string[] = [];
    for (const section of sections) {
      const name = section.querySelector('h2')?.textContent ?? 'tile';
      const box = section.getBoundingClientRect();
      const heading = section.querySelector('h2')?.getBoundingClientRect();
      if (section.scrollHeight > section.clientHeight + 1) found.push(`${name}: card scrolls`);
      for (const clipped of Array.from(section.querySelectorAll('.overflow-hidden'))) {
        if (clipped.scrollHeight > clipped.clientHeight + 1) {
          found.push(`${name}: body clips ${clipped.scrollHeight - clipped.clientHeight}px`);
        }
      }
      for (const element of Array.from(section.querySelectorAll('*'))) {
        if (element.closest('.sr-only') || element.closest('h2')) continue;
        const r = element.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (
          r.bottom > box.bottom + 1 ||
          r.top < box.top - 1 ||
          r.right > box.right + 1 ||
          r.left < box.left - 1
        ) {
          found.push(`${name}: ${element.tagName} outside card`);
        }
        if (
          heading &&
          r.top < heading.bottom - 1 &&
          r.bottom > heading.top + 1 &&
          r.left < heading.right &&
          r.right > heading.left
        ) {
          found.push(`${name}: ${element.tagName} overlaps the heading`);
        }
      }
    }
    return found;
  });
}
