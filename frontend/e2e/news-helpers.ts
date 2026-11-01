import type { Page } from '@playwright/test';

export const newsInstant = new Date('2026-11-01T10:30:00Z');

type Status = 'fresh' | 'stale' | 'error' | 'never-loaded';

interface Headline {
  id: string;
  title: string;
  publishedAt: string;
}

const minutesAgo = (minutes: number) =>
  new Date(newsInstant.getTime() - minutes * 60_000).toISOString();

export const longTitle =
  'Ein sehr langer Titel mit hundertsechzig Zeichen, der die Kachel an keiner Stelle sprengen darf, ' +
  'auch nicht auf den kleinsten Tablets mit nur siebenhundert Pixeln Höhe, weil er abgeschnitten wird';

export const localHeadlines: Headline[] = [
  { id: 'l1', title: 'Pyrotechnik an Halloween in Berlin', publishedAt: minutesAgo(12) },
  { id: 'l2', title: 'Hennigsdorfer Havelbrücke auf halbem Weg', publishedAt: minutesAgo(45) },
  { id: 'l3', title: longTitle.slice(0, 160), publishedAt: minutesAgo(90) },
];
export const globalHeadlines: Headline[] = [
  { id: 'g1', title: 'Zehn Tage gegen den Krieg im Kopf', publishedAt: minutesAgo(5) },
  { id: 'g2', title: 'Koalitionsverhandlungen beginnen', publishedAt: minutesAgo(120) },
];

export interface NewsMock {
  local?: Status;
  global?: Status;
}

function source(group: 'local' | 'global', status: Status) {
  const hasData = status === 'fresh' || status === 'stale';
  return {
    id: `news-${group}`,
    status,
    data: hasData
      ? {
          group,
          sourceName: group === 'local' ? 'rbb24' : 'Tagesschau',
          headlines: group === 'local' ? localHeadlines : globalHeadlines,
        }
      : null,
    lastUpdated: hasData ? minutesAgo(status === 'stale' ? 50 : 1) : null,
    ageSeconds: hasData ? (status === 'stale' ? 3000 : 60) : null,
    staleAfterSeconds: 2700,
    lastErrorCode: status === 'error' ? 'SOURCE_FETCH_FAILED' : null,
  };
}

export function newsSnapshotBody(mock: NewsMock = {}) {
  return {
    buildId: 'e2e',
    serverTime: newsInstant.toISOString(),
    settings: {
      timezone: 'Europe/Berlin',
      display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
    },
    sources: [source('local', mock.local ?? 'fresh'), source('global', mock.global ?? 'fresh')],
  };
}

export async function openNews(page: Page, mock: NewsMock = {}): Promise<void> {
  await page.route('**/api/v1/snapshot', (route) =>
    route.fulfill({ json: newsSnapshotBody(mock) }),
  );
  await page.goto('/');
  await page.getByRole('region', { name: 'Nachrichten' }).waitFor();
}

export const newsTile = (page: Page) => page.getByRole('region', { name: 'Nachrichten' });

export const activeTitle = (page: Page) =>
  page.locator('[data-headline-active="true"] [data-testid="headline-title"]').textContent();

/** Smallest font size of visible text inside an element. */
export async function smallestFontIn(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((root) => {
    let smallest = Number.POSITIVE_INFINITY;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || !node.textContent?.trim() || element.closest('[class*="sr-only"]')) continue;
      smallest = Math.min(smallest, Number.parseFloat(getComputedStyle(element).fontSize));
    }
    return smallest;
  });
}
