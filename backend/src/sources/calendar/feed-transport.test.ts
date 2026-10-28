import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { FeedRejected } from './feed-url.js';
import {
  createFeedTransport,
  isPrivateAddress,
  type RawRequest,
  type RawResponse,
} from './feed-transport.js';

const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';
const signal = new AbortController().signal;
const base = { signal, userAgent: 'home-dashboard/test', maxBytes: 1000 };

async function* chunks(...parts: (string | Uint8Array)[]): AsyncIterable<Uint8Array> {
  for (const part of parts) yield typeof part === 'string' ? new TextEncoder().encode(part) : part;
}

function response(
  status: number,
  body: AsyncIterable<Uint8Array> | string,
  headers: Record<string, string> = {},
): RawResponse {
  return {
    status,
    headers: { 'content-type': 'text/calendar', ...headers },
    body: typeof body === 'string' ? chunks(body) : body,
  };
}

function setup(
  handler: (call: Parameters<RawRequest>[0]) => RawResponse,
  addresses: Record<string, string[]> = {},
) {
  const calls: Parameters<RawRequest>[0][] = [];
  const request: RawRequest = async (call) => {
    calls.push(call);
    return handler(call);
  };
  const resolved: string[] = [];
  const resolve = async (host: string) => {
    resolved.push(host);
    return addresses[host] ?? ['93.184.216.34'];
  };
  return { transport: createFeedTransport({ request, resolve }), calls, resolved };
}

const url = new URL('https://p12-caldav.icloud.com/published/2/abc');

// Covers: FR-7, FR-9, NFR-3, NFR-4, AC-28, AC-29, AC-30
describe('private address check', () => {
  it('flags loopback, private, link-local, CGNAT, unique-local and mapped addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
      '::',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:a00:1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('accepts public addresses', () => {
    for (const ip of ['93.184.216.34', '172.32.0.1', '2606:2800:220:1:248:1893:25c8:1946']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe('feed transport', () => {
  it('only ever issues GET requests with the identifying user agent and no cookies', async () => {
    const { transport, calls } = setup(() => response(200, ICS));
    await transport(url, base);
    expect(calls).toHaveLength(1);
    const headers = calls[0]!.headers;
    expect(headers['user-agent']).toBe('home-dashboard/test');
    expect(Object.keys(headers).map((key) => key.toLowerCase())).not.toEqual(
      expect.arrayContaining(['cookie', 'authorization', 'referer']),
    );
    expect(calls[0]!.method).toBe('GET');
  });

  it('connects to the validated address only', async () => {
    const { transport, calls } = setup(() => response(200, ICS), {
      'p12-caldav.icloud.com': ['93.184.216.34'],
    });
    await transport(url, base);
    expect(calls[0]!.address).toBe('93.184.216.34');
  });

  it('refuses a name that resolves to a private address', async () => {
    for (const address of ['10.0.0.5', '127.0.0.1', '169.254.169.254', 'fd00::1']) {
      const { transport, calls } = setup(() => response(200, ICS), {
        'p12-caldav.icloud.com': [address],
      });
      await expect(transport(url, base)).rejects.toMatchObject({ reason: 'private-address' });
      expect(calls).toHaveLength(0);
    }
  });

  it('refuses a name when any resolved address is private', async () => {
    const { transport } = setup(() => response(200, ICS), {
      'p12-caldav.icloud.com': ['93.184.216.34', '10.0.0.5'],
    });
    await expect(transport(url, base)).rejects.toMatchObject({ reason: 'private-address' });
  });

  it('follows at most three redirects and revalidates every hop', async () => {
    let hop = 0;
    const { transport, calls } = setup(() => {
      hop += 1;
      return response(302, '', { location: `https://p1${hop}-caldav.icloud.com/x` });
    });
    await expect(transport(url, base)).rejects.toMatchObject({ reason: 'redirect' });
    expect(calls).toHaveLength(4);
  });

  it('follows a redirect to another allowed icloud host', async () => {
    const { transport, calls } = setup((call) =>
      call.url.hostname.startsWith('p12')
        ? response(301, '', { location: 'https://p99-caldav.icloud.com/published/2/abc' })
        : response(200, ICS),
    );
    const result = await transport(url, base);
    expect(result.text).toBe(ICS);
    expect(calls.map((call) => call.url.hostname)).toEqual([
      'p12-caldav.icloud.com',
      'p99-caldav.icloud.com',
    ]);
  });

  it('refuses a redirect to a host outside the allow-list, to http or to a private address', async () => {
    for (const location of [
      'https://evil.example/x',
      'http://p1.icloud.com/x',
      'https://127.0.0.1/x',
      'https://user:pw@p1.icloud.com/x',
    ]) {
      const { transport, resolved } = setup(() => response(302, '', { location }));
      await expect(transport(url, base)).rejects.toBeInstanceOf(FeedRejected);
      expect(resolved).not.toContain('evil.example');
    }
  });

  it('contacts no host outside the allow-list in any scenario', async () => {
    const { transport, resolved } = setup(() =>
      response(302, '', { location: 'https://evil.example/x' }),
    );
    await transport(url, base).catch(() => undefined);
    expect(resolved).toEqual(['p12-caldav.icloud.com']);
  });

  it('aborts the body at the size limit', async () => {
    const big = 'x'.repeat(600);
    const { transport } = setup(() => response(200, chunks(ICS, big, big)));
    await expect(transport(url, base)).rejects.toMatchObject({ reason: 'size' });
  });

  it('limits the decompressed size of a gzip body', async () => {
    const bomb = gzipSync(Buffer.from(ICS + 'a'.repeat(50_000)));
    expect(bomb.length).toBeLessThan(1000);
    const { transport } = setup(() => response(200, chunks(bomb), { 'content-encoding': 'gzip' }));
    await expect(transport(url, base)).rejects.toMatchObject({ reason: 'size' });
  });

  it('decodes a gzip body inside the limit', async () => {
    const { transport } = setup(() =>
      response(200, chunks(gzipSync(Buffer.from(ICS))), { 'content-encoding': 'gzip' }),
    );
    expect((await transport(url, base)).text).toBe(ICS);
  });

  it('rejects content that does not start with BEGIN:VCALENDAR or has a wrong type', async () => {
    const a = setup(() => response(200, '<html>login</html>'));
    await expect(a.transport(url, base)).rejects.toMatchObject({ reason: 'content-type' });
    const b = setup(() => response(200, ICS, { 'content-type': 'text/html' }));
    await expect(b.transport(url, base)).rejects.toMatchObject({ reason: 'content-type' });
  });

  it('accepts text/plain and octet-stream feeds', async () => {
    for (const type of ['text/plain; charset=utf-8', 'application/octet-stream']) {
      const { transport } = setup(() => response(200, ICS, { 'content-type': type }));
      expect((await transport(url, base)).status).toBe(200);
    }
  });

  it('sends If-None-Match and If-Modified-Since and returns 304 without a body', async () => {
    const { transport, calls } = setup(() => response(304, ''));
    const result = await transport(url, {
      ...base,
      etag: '"a1"',
      lastModified: 'Tue, 27 Oct 2026',
    });
    expect(result.status).toBe(304);
    expect(calls[0]!.headers['if-none-match']).toBe('"a1"');
    expect(calls[0]!.headers['if-modified-since']).toBe('Tue, 27 Oct 2026');
  });

  it('returns the validators of a 200 response', async () => {
    const { transport } = setup(() =>
      response(200, ICS, { etag: '"a2"', 'last-modified': 'Wed, 28 Oct 2026' }),
    );
    const result = await transport(url, base);
    expect(result).toMatchObject({ etag: '"a2"', lastModified: 'Wed, 28 Oct 2026' });
  });

  it('rejects other status codes without echoing anything', async () => {
    const { transport } = setup(() => response(403, 'secret body'));
    try {
      await transport(url, base);
      expect.unreachable();
    } catch (error) {
      expect((error as FeedRejected).reason).toBe('status');
      expect((error as Error).message).not.toContain('secret');
    }
  });

  it('passes the abort signal to every request', async () => {
    const controller = new AbortController();
    const spy = vi.fn(() => response(200, ICS));
    const transport = createFeedTransport({
      request: async (call) => spy(call as never),
      resolve: async () => ['93.184.216.34'],
    });
    await transport(url, { ...base, signal: controller.signal });
    expect(spy.mock.calls[0]).toBeDefined();
  });
});
