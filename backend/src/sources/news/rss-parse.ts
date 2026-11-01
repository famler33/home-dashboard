import { XMLParser } from 'fast-xml-parser';
import { UpstreamError } from '../weather/http.js';
import type { NewsHeadline } from './types.js';

const MAX_TITLE = 160;
const MAX_ID = 100;
const MAX_AGE_MS = 72 * 3_600_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  processEntities: false,
  htmlEntities: false,
  trimValues: true,
  // Titles keep their raw inner text so markup inside them can be stripped by us.
  stopNodes: ['*.item.title'],
});

const namedEntities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (_match, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body[1]?.toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    }
    return namedEntities[body.toLowerCase()] ?? '';
  });
}

const stripTags = (text: string): string => text.replace(/<[^>]*>/g, '');

/** Raw title text (CDATA unwrapped, markup removed, entities decoded once) as plain text. */
export function cleanTitle(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const text = stripTags(decodeEntities(stripTags(unwrapped)))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1)}…` : text;
}

const normalise = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value as unknown[];
  return value === undefined ? [] : [value];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function field(record: object, key: string): unknown {
  return (record as Record<string, unknown>)[key];
}

function itemsOf(document: string): unknown[] {
  // Entity declarations in a DOCTYPE are never honoured: the whole declaration is dropped.
  const withoutDoctype = document.replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/gi, '');
  let tree: unknown;
  try {
    tree = parser.parse(withoutDoctype);
  } catch {
    throw new UpstreamError();
  }
  const rss = typeof tree === 'object' && tree !== null ? field(tree, 'rss') : undefined;
  const channel = typeof rss === 'object' && rss !== null ? field(rss, 'channel') : undefined;
  if (typeof channel !== 'object' || channel === null) throw new UpstreamError();
  return asArray(field(channel, 'item'));
}

/** Parses an RSS 2.0 document into at most `max` plain-text headlines, newest feed entries first. */
export function parseRss(document: string, options: { now: number; max: number }): NewsHeadline[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const headlines: NewsHeadline[] = [];

  for (const item of itemsOf(document)) {
    if (headlines.length >= options.max) break;
    if (typeof item !== 'object' || item === null) continue;

    const title = cleanTitle(text(field(item, 'title')) ?? '');
    if (title === '') continue;

    const dateText = text(field(item, 'pubDate')) ?? text(field(item, 'dc:date'));
    const parsed = dateText === undefined ? Number.NaN : Date.parse(dateText);
    if (Number.isNaN(parsed)) continue;
    if (parsed < options.now - MAX_AGE_MS) continue;
    const published = parsed > options.now + FUTURE_TOLERANCE_MS ? options.now : parsed;

    const id = (
      text(field(item, 'guid')) ??
      text(field(item, 'link')) ??
      `t-${normalise(title)}`
    ).slice(0, MAX_ID);
    const key = normalise(title);
    if (seenIds.has(id) || seenTitles.has(key)) continue;
    seenIds.add(id);
    seenTitles.add(key);

    headlines.push({
      id,
      title,
      publishedAt: new Date(Math.min(published, options.now)).toISOString(),
    });
  }
  return headlines;
}
