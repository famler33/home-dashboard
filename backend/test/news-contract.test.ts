import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createNewsSource } from '../src/sources/news/news-source.js';

const now = Date.parse('2026-11-01T10:30:00Z');
const read = (name: string): string =>
  readFileSync(new URL(`./fixtures/news/${name}`, import.meta.url), 'utf8');

async function payload(group: 'local' | 'global', file: string) {
  const fetchImpl = vi.fn(
    async () => new Response(read(file), { headers: { 'content-type': 'text/xml' } }),
  ) as unknown as typeof fetch;
  return createNewsSource({ group, fetchImpl, userAgent: 'test', now: () => now }).fetch(
    new AbortController().signal,
  );
}

// Covers: AC-1, AC-26, FR-2 (contract with recorded feeds)
describe('news payload contract', () => {
  it('has no link, description or content key and no URL outside the id', async () => {
    for (const [group, file] of [
      ['local', 'rbb24.sample.xml'],
      ['global', 'tagesschau.sample.xml'],
    ] as const) {
      const result = await payload(group, file);
      for (const headline of result.headlines) {
        expect(Object.keys(headline).sort()).toEqual(['id', 'publishedAt', 'title']);
        expect(headline.title).not.toMatch(/https?:\/\//);
      }
      expect(JSON.stringify(result)).not.toMatch(/"(link|description|content|image)"/);
    }
  });
});
