import { isIP } from 'node:net';

export type FeedRejectReason =
  'url' | 'host' | 'redirect' | 'private-address' | 'size' | 'content-type' | 'status' | 'parse';

/** A refused feed. Carries a closed reason only, never the URL, a host name or feed text. */
export class FeedRejected extends Error {
  constructor(readonly reason: FeedRejectReason) {
    super(`calendar feed rejected: ${reason}`);
    this.name = 'FeedRejected';
  }
}

const allowedSuffixes = ['calendar.google.com', 'icloud.com'] as const;

export function isAllowedHost(host: string): boolean {
  const name = host.toLowerCase();
  return allowedSuffixes.some((suffix) => name === suffix || name.endsWith(`.${suffix}`));
}

/** Validates a feed address and rewrites `webcal://` to `https://`. */
export function normaliseFeedUrl(raw: string): URL {
  const text = raw.trim().replace(/^webcal:\/\//i, 'https://');
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new FeedRejected('url');
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') {
    throw new FeedRejected('url');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) !== 0) throw new FeedRejected('url');
  if (!isAllowedHost(host)) throw new FeedRejected('host');
  return url;
}
