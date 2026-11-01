import { describe, expect, it, vi } from 'vitest';
import { UpstreamError } from '../weather/http.js';
import { getText } from './text-fetch.js';

const url = new URL('https://www.rbb24.de/aktuell/index.xml/feed=rss.xml');
const signal = new AbortController().signal;
const options = { signal, userAgent: 'home-dashboard/test', maxBytes: 1000 };

function respond(body: string, init: ResponseInit = {}) {
  return vi.fn(
    async () =>
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/xml;charset=utf-8' },
        ...init,
      }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

// Covers: FR-7, NFR-4 (F-5)
describe('getText', () => {
  it('returns the body text of an xml response', async () => {
    expect(await getText(respond('<rss/>'), url, options)).toBe('<rss/>');
  });

  it('sends an identifying user agent, no cookies, no referrer and refuses redirects', async () => {
    const fetchImpl = respond('<rss/>');
    await getText(fetchImpl, url, options);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(init.redirect).toBe('error');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers['user-agent']).toBe('home-dashboard/test');
    expect(headers['cookie']).toBeUndefined();
  });

  it('rejects non-2xx answers without leaking the url', async () => {
    const error = await getText(respond('x', { status: 503 }), url, options).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(UpstreamError);
    expect(String((error as Error).message)).not.toContain('rbb24');
  });

  it('rejects content that is not xml', async () => {
    await expect(
      getText(respond('<html/>', { headers: { 'content-type': 'text/html' } }), url, options),
    ).rejects.toBeInstanceOf(UpstreamError);
  });

  it('rejects bodies larger than the limit', async () => {
    await expect(getText(respond('x'.repeat(2000)), url, options)).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });

  it('turns network errors into an upstream error and lets aborts through', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('connect ECONNREFUSED 1.2.3.4');
    }) as unknown as typeof fetch;
    await expect(getText(failing, url, options)).rejects.toBeInstanceOf(UpstreamError);
    const aborting = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    await expect(getText(aborting, url, options)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
