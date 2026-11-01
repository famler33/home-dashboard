import type { Snapshot, SourceSnapshot } from '../../api/types';
import { snapshotFixture } from '../../test-fixtures';
import type { NewsHeadlineData, NewsPayload } from './types';

export const newsNow = Date.parse('2026-11-01T10:30:00Z');

export function headline(
  title: string,
  minutesAgo = 12,
  id = `id-${title}`,
): NewsHeadlineData {
  return { id, title, publishedAt: new Date(newsNow - minutesAgo * 60_000).toISOString() };
}

export function newsEntry(
  group: 'local' | 'global',
  headlines: NewsHeadlineData[],
  extra: Partial<SourceSnapshot> = {},
): SourceSnapshot {
  const payload: NewsPayload = {
    group,
    sourceName: group === 'local' ? 'rbb24' : 'Tagesschau',
    headlines,
  };
  return {
    id: group === 'local' ? 'news-local' : 'news-global',
    status: 'fresh',
    data: payload,
    lastUpdated: '2026-11-01T10:29:30.000Z',
    ageSeconds: 30,
    staleAfterSeconds: 2700,
    lastErrorCode: null,
    ...extra,
  };
}

export const defaultNewsSources = (): SourceSnapshot[] => [
  newsEntry('local', [headline('Lokal eins'), headline('Lokal zwei', 30)]),
  newsEntry('global', [headline('Welt eins', 5), headline('Welt zwei', 90)]),
];

export function newsSnapshot(sources: SourceSnapshot[] = defaultNewsSources()): Snapshot {
  return snapshotFixture({ serverTime: new Date(newsNow).toISOString(), sources });
}
