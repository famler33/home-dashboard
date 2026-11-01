import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { FeedRequestOptions, FeedResponse, FeedTransport } from './feed-transport.js';
import { FeedRejected, normaliseFeedUrl } from './feed-url.js';
import { createCalendarSource } from './calendar-source.js';

const family = readFileSync(
  new URL('../../../test/fixtures/calendar/icloud-family.sample.ics', import.meta.url),
  'utf8',
);
const signal = new AbortController().signal;
const url = normaliseFeedUrl('webcal://p12-caldav.icloud.com/published/2/SECRET-TOKEN');
const now = () => new Date('2026-10-28T10:00:00Z');

function create(
  respond: (options: FeedRequestOptions, call: number) => FeedResponse | Promise<FeedResponse>,
  logger = { warn: vi.fn() },
) {
  let call = 0;
  const transport: FeedTransport = vi.fn(async (_url, options) => respond(options, (call += 1)));
  const source = createCalendarSource({
    id: 'calendar-family',
    url,
    timezone: 'Europe/Berlin',
    selfAddresses: [],
    transport,
    userAgent: 'home-dashboard/test',
    now,
    logger,
  });
  return { source, transport: transport as ReturnType<typeof vi.fn>, logger };
}

// Covers: FR-7, FR-8, NFR-4, AC-28, AC-29, AC-30, AC-31
describe('calendar source', () => {
  it('declares a 900 second interval, a 1800 second stale threshold and a 20 second timeout', () => {
    const { source } = create(() => ({ status: 200, text: family }));
    expect(source.id).toBe('calendar-family');
    expect(source.intervalSeconds).toBe(900);
    expect(source.staleAfterSeconds).toBe(1800);
    expect(source.timeoutMs).toBe(20_000);
  });

  it('returns the expanded events of the feed', async () => {
    const { source } = create(() => ({ status: 200, text: family }));
    const payload = await source.fetch(signal);
    expect(payload.events.length).toBeGreaterThan(10);
    expect(payload.truncated).toBe(false);
  });

  it('sends If-None-Match and re-expands the kept text on a 304', async () => {
    const { source, transport } = create((options, call) =>
      call === 1
        ? { status: 200, text: family, etag: '"v1"', lastModified: 'Wed, 28 Oct 2026 08:00:00 GMT' }
        : { status: 304 },
    );
    const first = await source.fetch(signal);
    const second = await source.fetch(signal);
    expect(second).toEqual(first);
    const secondOptions = transport.mock.calls[1]![1] as FeedRequestOptions;
    expect(secondOptions.etag).toBe('"v1"');
    expect(secondOptions.lastModified).toBe('Wed, 28 Oct 2026 08:00:00 GMT');
  });

  it('does a plain request first and fails on a 304 without kept text', async () => {
    const { source } = create(() => ({ status: 304 }));
    await expect(source.fetch(signal)).rejects.toBeInstanceOf(FeedRejected);
  });

  it('logs only the source id and a reason and rethrows a refused feed', async () => {
    const logger = { warn: vi.fn() };
    const { source } = create(() => {
      throw new FeedRejected('size');
    }, logger);
    await expect(source.fetch(signal)).rejects.toBeInstanceOf(FeedRejected);
    expect(logger.warn).toHaveBeenCalledWith({ sourceId: 'calendar-family', reason: 'size' });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('SECRET-TOKEN');
  });

  it('keeps timeouts as they are so the runner stores SOURCE_TIMEOUT', async () => {
    const { source } = create(() => {
      throw new DOMException('aborted', 'TimeoutError');
    });
    await expect(source.fetch(signal)).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('passes the identifying user agent, the size limit and the abort signal to the transport', async () => {
    const { source, transport } = create(() => ({ status: 200, text: family }));
    await source.fetch(signal);
    const options = transport.mock.calls[0]![1] as FeedRequestOptions;
    expect(options.userAgent).toBe('home-dashboard/test');
    expect(options.maxBytes).toBe(8_000_000);
    expect(options.signal).toBe(signal);
  });
});
