import { Value } from '@sinclair/typebox/value';
import type { Source } from '../source.js';
import { UpstreamError } from '../weather/http.js';
import { newsFeeds } from './catalogue.js';
import { parseRss } from './rss-parse.js';
import { getText } from './text-fetch.js';
import { newsPayloadSchema, type NewsGroup, type NewsPayload } from './types.js';

const MAX_HEADLINES = 5;
const MAX_BYTES = 512_000;

export function createNewsSource(deps: {
  group: NewsGroup;
  fetchImpl: typeof fetch;
  userAgent: string;
  now?: () => number;
}): Source<NewsPayload> {
  const feed = newsFeeds[deps.group];
  const now = deps.now ?? Date.now;

  return {
    id: feed.sourceId,
    intervalSeconds: 900,
    staleAfterSeconds: 2700,
    timeoutMs: 15_000,
    async fetch(signal) {
      const text = await getText(deps.fetchImpl, new URL(feed.url), {
        signal,
        userAgent: deps.userAgent,
        maxBytes: MAX_BYTES,
      });
      const payload: NewsPayload = {
        group: deps.group,
        sourceName: feed.sourceName,
        headlines: parseRss(text, { now: now(), max: MAX_HEADLINES }),
      };
      if (!Value.Check(newsPayloadSchema, payload)) throw new UpstreamError();
      return payload;
    },
  };
}
