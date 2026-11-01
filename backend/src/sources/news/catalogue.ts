import type { NewsGroup } from './types.js';

/** Fixed feeds: hosts are constants in code and never come from configuration. */
export const newsFeeds = {
  local: {
    sourceId: 'news-local',
    url: 'https://www.rbb24.de/aktuell/index.xml/feed=rss.xml',
    sourceName: 'rbb24',
  },
  global: {
    sourceId: 'news-global',
    url: 'https://www.tagesschau.de/index~rss2.xml',
    sourceName: 'Tagesschau',
  },
} as const satisfies Record<NewsGroup, { sourceId: string; url: string; sourceName: string }>;
