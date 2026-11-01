import { readFileSync } from 'node:fs';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it, vi } from 'vitest';
import { newsFeeds } from './catalogue.js';
import { createNewsSource } from './news-source.js';
import { newsPayloadSchema } from './types.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../test/fixtures/news/${name}`, import.meta.url), 'utf8');
const now = Date.parse('2026-11-01T10:30:00Z');
const signal = new AbortController().signal;

function create(group: 'local' | 'global', body?: string, status = 200) {
  const text = body ?? fixture(group === 'local' ? 'rbb24.sample.xml' : 'tagesschau.sample.xml');
  const fetchImpl = vi.fn(
    async () => new Response(text, { status, headers: { 'content-type': 'application/xml' } }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  const source = createNewsSource({
    group,
    fetchImpl,
    userAgent: 'home-dashboard/test',
    now: () => now,
  });
  return { source, fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

// Covers: FR-1, FR-6, FR-7, AC-1, AC-16, AC-17, AC-19
describe('news source', () => {
  it('declares its id, interval, stale threshold and timeout', () => {
    const local = create('local').source;
    expect(local.id).toBe('news-local');
    expect(local.intervalSeconds).toBe(900);
    expect(local.staleAfterSeconds).toBe(2700);
    expect(local.timeoutMs).toBe(15_000);
    expect(create('global').source.id).toBe('news-global');
  });

  it('fetches only the fixed catalogue host', async () => {
    const { source, fetchImpl } = create('global');
    await source.fetch(signal);
    expect((fetchImpl.mock.calls[0] as [URL])[0].href).toBe(newsFeeds.global.url);
    expect(new URL(newsFeeds.local.url).host).toBe('www.rbb24.de');
    expect(new URL(newsFeeds.global.url).host).toBe('www.tagesschau.de');
  });

  it('maps both recorded feeds to payloads that match the schema', async () => {
    const local = await create('local').source.fetch(signal);
    const global = await create('global').source.fetch(signal);
    expect(Value.Check(newsPayloadSchema, local)).toBe(true);
    expect(Value.Check(newsPayloadSchema, global)).toBe(true);
    expect(local).toMatchObject({ group: 'local', sourceName: 'rbb24' });
    expect(global).toMatchObject({ group: 'global', sourceName: 'Tagesschau' });
    expect(local.headlines.length).toBeGreaterThan(0);
    expect(local.headlines.length).toBeLessThanOrEqual(5);
  });

  it('rejects when the upstream answers with an error so the runner keeps the old payload', async () => {
    await expect(create('local', '<rss/>', 500).source.fetch(signal)).rejects.toThrow();
  });

  it('returns an empty headline list for a valid feed without items', async () => {
    const empty = '<rss version="2.0"><channel><title>t</title></channel></rss>';
    expect((await create('local', empty).source.fetch(signal)).headlines).toEqual([]);
  });
});
