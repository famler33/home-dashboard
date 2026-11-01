import type { Snapshot, SourceSnapshot } from '../../api/types';

/**
 * One entry for the tile frame from the news sources: the tile is fresh while any source is
 * fresh (a single stale or failed source is marked on its own headlines), stale when every
 * source with data is stale, and error or never-loaded when no source has data.
 */
export function deriveNewsEntry(snapshot: Snapshot | null): SourceSnapshot | undefined {
  const entries = snapshot?.sources.filter((source) => source.id.startsWith('news-')) ?? [];
  if (entries.length === 0) return undefined;

  const withData = entries.filter((entry) => entry.status === 'fresh' || entry.status === 'stale');
  const fresh = withData.filter((entry) => entry.status === 'fresh');
  const ages = (list: SourceSnapshot[]) => list.map((entry) => entry.ageSeconds ?? 0);
  const base = {
    id: 'news',
    data: {},
    staleAfterSeconds: Math.min(...entries.map((entry) => entry.staleAfterSeconds)),
    lastUpdated: null as string | null,
    ageSeconds: null as number | null,
    lastErrorCode: entries.find((entry) => entry.lastErrorCode !== null)?.lastErrorCode ?? null,
  };

  if (withData.length === 0) {
    const failed = entries.some((entry) => entry.status === 'error');
    return { ...base, status: failed ? 'error' : 'never-loaded' };
  }
  if (fresh.length === 0) {
    return { ...base, status: 'stale', ageSeconds: Math.max(...ages(withData)) };
  }
  const newest = fresh.reduce((a, b) => ((a.ageSeconds ?? 0) <= (b.ageSeconds ?? 0) ? a : b));
  return {
    ...base,
    status: 'fresh',
    lastUpdated: newest.lastUpdated,
    ageSeconds: Math.min(...ages(fresh)),
  };
}
