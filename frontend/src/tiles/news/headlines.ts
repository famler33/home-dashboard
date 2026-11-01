import type { SourceSnapshot } from '../../api/types';
import { isNewsPayload, type NewsGroup } from './types';

export interface Headline {
  id: string;
  group: NewsGroup;
  sourceName: string;
  title: string;
  publishedAt: string;
  /** The source of this headline is older than its threshold. */
  stale: boolean;
  /** Age of the source in seconds while it is stale, else `null`. */
  sourceAgeSeconds: number | null;
}

export interface NewsSourceView {
  entry: SourceSnapshot;
  /** Effective age of the entry in seconds (server age plus time since receipt). */
  ageSeconds: number | null;
}

const groupOrder: Record<NewsGroup, number> = { local: 0, global: 1 };

/** All headlines of the sources with data: local group first, feed order inside a group. */
export function buildHeadlines(sources: readonly NewsSourceView[]): Headline[] {
  const usable = sources
    .filter(({ entry }) => entry.status === 'fresh' || entry.status === 'stale')
    .flatMap(({ entry, ageSeconds }) =>
      isNewsPayload(entry.data) ? [{ entry, ageSeconds, payload: entry.data }] : [],
    )
    .sort((a, b) => groupOrder[a.payload.group] - groupOrder[b.payload.group]);

  return usable.flatMap(({ entry, ageSeconds, payload }) => {
    const stale =
      entry.status === 'stale' || (ageSeconds !== null && ageSeconds > entry.staleAfterSeconds);
    return payload.headlines.map((item) => ({
      id: `${entry.id}:${item.id}`,
      group: payload.group,
      sourceName: payload.sourceName,
      title: item.title,
      publishedAt: item.publishedAt,
      stale,
      sourceAgeSeconds: stale ? ageSeconds : null,
    }));
  });
}
