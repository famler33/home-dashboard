import type { Snapshot, SourceSnapshot } from '../../api/types';

/**
 * One entry for the tile frame from the calendar sources: the tile is fresh while any calendar
 * is fresh (single problems are shown inside the tile), stale when every calendar with data is
 * stale, and error or never-loaded when no calendar has data.
 */
export function deriveCalendarEntry(snapshot: Snapshot | null): SourceSnapshot | undefined {
  const entries = snapshot?.sources.filter((source) => source.id.startsWith('calendar-')) ?? [];
  if (entries.length === 0) return undefined;

  const withData = entries.filter((entry) => entry.status === 'fresh' || entry.status === 'stale');
  const fresh = withData.filter((entry) => entry.status === 'fresh');
  const ages = (list: SourceSnapshot[]) => list.map((entry) => entry.ageSeconds ?? 0);
  const staleAfter = Math.min(...entries.map((entry) => entry.staleAfterSeconds));
  const base = {
    id: 'calendar',
    data: {},
    staleAfterSeconds: staleAfter,
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
