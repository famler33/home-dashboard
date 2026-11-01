import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UpstreamError } from '../weather/http.js';
import { parseRss } from './rss-parse.js';

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../test/fixtures/news/${name}`, import.meta.url), 'utf8');

const now = Date.parse('2026-11-01T10:30:00Z');

function feed(items: string, extra = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>t</title>${extra}${items}</channel></rss>`;
}

function item(title: string, opts: { guid?: string; date?: string; link?: string } = {}): string {
  const date = opts.date ?? 'Sun, 01 Nov 2026 10:00:00 +0100';
  return `<item><title>${title}</title>${
    opts.link === undefined ? '' : `<link>${opts.link}</link>`
  }<pubDate>${date}</pubDate>${opts.guid === undefined ? '' : `<guid>${opts.guid}</guid>`}</item>`;
}

// Covers: FR-2, AC-3, AC-4, AC-25 (F-1)
describe('parseRss', () => {
  it('reads the recorded rbb24 feed in feed order with decoded umlauts', () => {
    const result = parseRss(fixture('rbb24.sample.xml'), { now, max: 5 });
    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({
      title: 'Etwas Pyrotechnik, ansonsten wenig Straftaten an Halloween',
      publishedAt: '2026-11-01T09:43:13.000Z',
    });
    expect(result[1]?.title).toBe(
      'Demo "GenZ hat genug!": Steinwürfe und Pyrotechnik - Polizei stoppt Demo in Berlin',
    );
  });

  it('reads the recorded Tagesschau feed and uses the guid as id', () => {
    const result = parseRss(fixture('tagesschau.sample.xml'), { now, max: 5 });
    expect(result).toHaveLength(5);
    expect(result[0]).toMatchObject({
      id: '3b94377f-8bd4-4fde-aba6-6f4a2f5243e0',
      title: 'Ukraine: Zehn Tage gegen den Krieg im Kopf',
      publishedAt: '2026-11-01T08:43:57.000Z',
    });
  });

  it('keeps only the id, title and time of an item', () => {
    const result = parseRss(fixture('tagesschau.sample.xml'), { now, max: 5 });
    expect(Object.keys(result[0]!).sort()).toEqual(['id', 'publishedAt', 'title']);
  });

  it('caps the list at the requested maximum and returns fewer when fewer exist', () => {
    const many = feed(
      Array.from({ length: 12 }, (_, i) => item(`Titel ${i}`, { guid: `g${i}` })).join(''),
    );
    expect(parseRss(many, { now, max: 5 }).map((h) => h.title)).toEqual([
      'Titel 0',
      'Titel 1',
      'Titel 2',
      'Titel 3',
      'Titel 4',
    ]);
    expect(parseRss(feed(item('Nur einer', { guid: 'x' })), { now, max: 5 })).toHaveLength(1);
  });

  it('turns entities, CDATA and markup in titles into plain text', () => {
    const xml = feed(
      item('K&#252;che &amp; <![CDATA[Bad <b>fett</b>]]>', { guid: 'a' }) +
        item('Mit <b>Tags</b> &lt;i&gt;drin', { guid: 'b' }),
    );
    const titles = parseRss(xml, { now, max: 5 }).map((h) => h.title);
    expect(titles[0]).toBe('Küche & Bad fett');
    expect(titles[1]).not.toMatch(/[<>]/);
  });

  it('removes control characters and collapses whitespace', () => {
    const xml = feed(item('Eins\u0000   zwei\n\tdrei', { guid: 'a' }));
    expect(parseRss(xml, { now, max: 5 })[0]?.title).toBe('Eins zwei drei');
  });

  it('cuts long titles to 160 characters with an ellipsis', () => {
    const xml = feed(item('x'.repeat(400), { guid: 'a' }));
    const title = parseRss(xml, { now, max: 5 })[0]!.title;
    expect(title).toHaveLength(160);
    expect(title.endsWith('…')).toBe(true);
  });

  it('does not expand entities declared in a DOCTYPE', () => {
    const xml = `<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY boom "AAAAAAAAAA">]><rss version="2.0"><channel>${item('Wert &boom; Ende', { guid: 'a' })}</channel></rss>`;
    const result = parseRss(xml, { now, max: 5 });
    expect(result[0]?.title ?? '').not.toContain('AAAAAAAAAA');
  });

  it('survives a deeply nested hostile document', () => {
    const xml = feed(`<item><title>${'<b>'.repeat(20000)}x${'</b>'.repeat(20000)}</title></item>`);
    expect(() => parseRss(xml, { now, max: 5 })).not.toThrow(/stack/);
  });

  it('drops duplicates by guid and by normalised title', () => {
    const xml = feed(
      item('Gleiche Meldung', { guid: 'same' }) +
        item('Andere Zeile', { guid: 'same' }) +
        item('Gleiche   MELDUNG!', { guid: 'other' }) +
        item('Wirklich neu', { guid: 'new' }),
    );
    expect(parseRss(xml, { now, max: 5 }).map((h) => h.title)).toEqual([
      'Gleiche Meldung',
      'Wirklich neu',
    ]);
  });

  it('drops items with an empty title or an invalid date', () => {
    const xml = feed(
      item('', { guid: 'a' }) +
        item('Kaputtes Datum', { guid: 'b', date: 'gestern' }) +
        item('Gut', { guid: 'c' }),
    );
    expect(parseRss(xml, { now, max: 5 }).map((h) => h.title)).toEqual(['Gut']);
  });

  it('drops items older than 72 hours and clamps future dates to now', () => {
    const xml = feed(
      item('Alt', { guid: 'a', date: 'Wed, 28 Oct 2026 10:00:00 +0100' }) +
        item('Zukunft', { guid: 'b', date: 'Mon, 02 Nov 2026 10:00:00 +0100' }),
    );
    const result = parseRss(xml, { now, max: 5 });
    expect(result.map((h) => h.title)).toEqual(['Zukunft']);
    expect(result[0]?.publishedAt).toBe('2026-11-01T10:30:00.000Z');
  });

  it('falls back to dc:date and then the link for the id', () => {
    const xml = feed(
      `<item><title>Mit dc</title><dc:date>2026-11-01T09:00:00Z</dc:date><link>https://example.org/a</link></item>`,
    );
    const [first] = parseRss(xml, { now, max: 5 });
    expect(first?.publishedAt).toBe('2026-11-01T09:00:00.000Z');
    expect(first?.id).toBe('https://example.org/a');
  });

  it('limits the id to 100 characters', () => {
    const xml = feed(item('Lang', { guid: 'g'.repeat(300) }));
    expect(parseRss(xml, { now, max: 5 })[0]?.id).toHaveLength(100);
  });

  it('returns an empty list for a valid feed without usable items', () => {
    expect(parseRss(feed(''), { now, max: 5 })).toEqual([]);
  });

  it('rejects documents that are not RSS', () => {
    expect(() => parseRss('<html><body>nope</body></html>', { now, max: 5 })).toThrow(
      UpstreamError,
    );
    expect(() => parseRss('not xml at all', { now, max: 5 })).toThrow(UpstreamError);
  });
});
