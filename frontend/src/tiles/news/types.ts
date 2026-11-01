export type NewsGroup = 'local' | 'global';

export interface NewsHeadlineData {
  id: string;
  title: string;
  /** ISO UTC instant of the publication. */
  publishedAt: string;
}

export interface NewsPayload {
  group: NewsGroup;
  sourceName: string;
  headlines: NewsHeadlineData[];
}

function isHeadline(value: unknown): value is NewsHeadlineData {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['id'] === 'string' &&
    typeof record['title'] === 'string' &&
    typeof record['publishedAt'] === 'string'
  );
}

export function isNewsPayload(value: unknown): value is NewsPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record['group'] === 'local' || record['group'] === 'global') &&
    typeof record['sourceName'] === 'string' &&
    Array.isArray(record['headlines']) &&
    record['headlines'].every(isHeadline)
  );
}
