import type { Logger } from '../../logger.js';
import type { Source } from '../source.js';
import type { FeedTransport } from './feed-transport.js';
import { FeedRejected } from './feed-url.js';
import { expandCalendar } from './ics-expand.js';
import type { CalendarPayload } from './types.js';

const MAX_BYTES = 8_000_000;

export type CalendarSourceId = 'calendar-family' | 'calendar-person-1' | 'calendar-person-2';

export function createCalendarSource(deps: {
  id: CalendarSourceId;
  url: URL;
  timezone: string;
  selfAddresses: readonly string[];
  transport: FeedTransport;
  userAgent: string;
  now?: () => Date;
  logger?: Pick<Logger, 'warn'>;
}): Source<CalendarPayload> {
  const now = deps.now ?? (() => new Date());
  // The last response is kept in memory only, so a 304 can be expanded again without a download.
  let kept: { text: string; etag?: string; lastModified?: string } | undefined;

  return {
    id: deps.id,
    intervalSeconds: 900,
    staleAfterSeconds: 1800,
    timeoutMs: 20_000,
    async fetch(signal) {
      try {
        const response = await deps.transport(deps.url, {
          signal,
          userAgent: deps.userAgent,
          maxBytes: MAX_BYTES,
          etag: kept?.etag,
          lastModified: kept?.lastModified,
        });
        if (response.status === 200 && response.text !== undefined) {
          kept = {
            text: response.text,
            ...(response.etag ? { etag: response.etag } : {}),
            ...(response.lastModified ? { lastModified: response.lastModified } : {}),
          };
        } else if (!kept) {
          throw new FeedRejected('status');
        }
        return expandCalendar(kept.text, {
          now: now(),
          timezone: deps.timezone,
          selfAddresses: deps.selfAddresses,
        });
      } catch (error) {
        if (error instanceof FeedRejected) {
          deps.logger?.warn({ sourceId: deps.id, reason: error.reason });
        }
        throw error;
      }
    },
  };
}
