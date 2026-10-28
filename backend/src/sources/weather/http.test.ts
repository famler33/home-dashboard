import { describe, expect, it, vi } from 'vitest';
import { getJson, roundForUpstream, UpstreamError } from './http.js';

const signal = new AbortController().signal;
const url = new URL('https://api.open-meteo.com/v1/forecast?latitude=52.52');
const options = { signal, userAgent: 'home-dashboard/test', maxBytes: 1_000 };

function respond(body: BodyInit | null, init: ResponseInit = {}): typeof fetch {
  return vi.fn(async () => new Response(body, { status: 200, ...init })) as unknown as typeof fetch;
}

// Covers: NFR-4, NFR-8, AC-1
describe('roundForUpstream', () => {
  it.each([
    [52.5234, 52.52],
    [13.405, 13.41],
    [-0.004, -0],
    [48.1999, 48.2],
  ])('rounds %f to two decimals', (value, expected) => {
    expect(roundForUpstream(value)).toBe(expected);
  });
});

describe('getJson', () => {
  it('parses a JSON body', async () => {
    await expect(getJson(respond('{"a":1}'), url, options)).resolves.toEqual({ a: 1 });
  });

  it('sends an identifying user agent without cookies or referrer and refuses redirects', async () => {
    const fetchImpl = respond('{}');
    await getJson(fetchImpl, url, options);
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(init.redirect).toBe('error');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.signal).toBe(signal);
    const headers = new Headers(init.headers);
    expect(headers.get('user-agent')).toBe('home-dashboard/test');
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('referer')).toBeNull();
    expect(headers.get('accept')).toContain('application/json');
  });

  it('throws a generic UpstreamError for non-ok responses without leaking the body', async () => {
    const failing = respond('{"reason":"SECRET-LEAK 52.52"}', { status: 503 });
    const error = await getJson(failing, url, options).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(String((error as Error).message)).not.toContain('SECRET-LEAK');
    expect(String((error as Error).message)).not.toContain('52.52');
    expect(String((error as Error).message)).not.toContain('open-meteo');
  });

  it('throws for bodies that are not JSON without echoing them', async () => {
    const error = await getJson(respond('<html>SECRET-LEAK'), url, options).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(UpstreamError);
    expect(String((error as Error).message)).not.toContain('SECRET-LEAK');
  });

  it('rejects a declared content length above the limit', async () => {
    const fetchImpl = respond('{}', { headers: { 'content-length': '5000' } });
    await expect(getJson(fetchImpl, url, options)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('rejects a streamed body above the limit', async () => {
    const big = JSON.stringify({ filler: 'x'.repeat(2_000) });
    await expect(getJson(respond(big), url, options)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('propagates network errors as UpstreamError without the original message', async () => {
    const failing = vi.fn(async () => {
      throw new Error('connect ECONNREFUSED 52.52.0.1 SECRET-LEAK');
    }) as unknown as typeof fetch;
    const error = await getJson(failing, url, options).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(String((error as Error).message)).not.toContain('SECRET-LEAK');
  });

  it('keeps abort errors recognisable as timeouts', async () => {
    const aborting = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    const error = await getJson(aborting, url, options).catch((e: unknown) => e);
    expect((error as Error).name).toBe('AbortError');
  });
});
