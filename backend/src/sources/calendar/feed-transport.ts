import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { gunzipSync } from 'node:zlib';
import { FeedRejected, normaliseFeedUrl } from './feed-url.js';

const MAX_REDIRECTS = 3;
const allowedTypes = ['text/calendar', 'text/plain', 'application/octet-stream'];

const blocked = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(net, bits, 'ipv4');
}
blocked.addAddress('::', 'ipv6');
blocked.addAddress('::1', 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');
blocked.addSubnet('ff00::', 8, 'ipv6');

/** True for loopback, private, link-local, CGNAT, unique-local, multicast and unspecified addresses. */
export function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return blocked.check(address, 'ipv4');
  if (kind === 6) {
    const lower = address.toLowerCase();
    const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (dotted?.[1]) return blocked.check(dotted[1], 'ipv4');
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (hex?.[1] && hex[2]) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      return blocked.check(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`, 'ipv4');
    }
    return blocked.check(address, 'ipv6');
  }
  return true;
}

export interface RawResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: AsyncIterable<Uint8Array>;
}

export interface RawRequestCall {
  method: 'GET';
  url: URL;
  /** The validated address to connect to; the host name is only used for TLS. */
  address: string;
  signal: AbortSignal;
  headers: Record<string, string>;
}

export type RawRequest = (call: RawRequestCall) => Promise<RawResponse>;
export type Resolve = (host: string) => Promise<string[]>;

export interface FeedResponse {
  status: 200 | 304;
  text?: string;
  etag?: string;
  lastModified?: string;
}

export interface FeedRequestOptions {
  signal: AbortSignal;
  userAgent: string;
  maxBytes: number;
  etag?: string | undefined;
  lastModified?: string | undefined;
}

export type FeedTransport = (url: URL, options: FeedRequestOptions) => Promise<FeedResponse>;

const defaultResolve: Resolve = async (host) =>
  (await dnsLookup(host, { all: true })).map((entry) => entry.address);

const defaultRequest: RawRequest = (call) =>
  new Promise((resolve, reject) => {
    const family = isIP(call.address);
    const req = httpsRequest(
      call.url,
      {
        method: call.method,
        headers: call.headers,
        signal: call.signal,
        agent: false,
        // Pins the connection to the address that was validated, so DNS cannot change in between.
        lookup: ((
          _host: string,
          options: { all?: boolean },
          callback: (...args: unknown[]) => void,
        ) =>
          options.all
            ? callback(null, [{ address: call.address, family }])
            : callback(null, call.address, family)) as never,
      },
      (res) => {
        const headers: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          headers[key] = Array.isArray(value) ? value[0] : value;
        }
        resolve({ status: res.statusCode ?? 0, headers, body: res });
      },
    );
    req.on('error', reject);
    req.end();
  });

async function readLimited(body: AsyncIterable<Uint8Array>, maxBytes: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > maxBytes) throw new FeedRejected('size');
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts);
}

/**
 * Guarded feed download: https only, host allow-list, manual redirects (at most three, each hop
 * checked again), validated and pinned addresses, one abort signal, size limit before and after
 * decompression. Failures carry a closed reason, never a URL or upstream text.
 */
export function createFeedTransport(
  deps: { request?: RawRequest; resolve?: Resolve } = {},
): FeedTransport {
  const request = deps.request ?? defaultRequest;
  const resolve = deps.resolve ?? defaultResolve;

  return async (start, options) => {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const checked = normaliseFeedUrl(url.href);
      const addresses = await resolve(checked.hostname);
      if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        throw new FeedRejected('private-address');
      }
      const headers: Record<string, string> = {
        'user-agent': options.userAgent,
        accept: 'text/calendar, text/plain;q=0.8, */*;q=0.1',
        'accept-encoding': 'gzip',
      };
      if (options.etag) headers['if-none-match'] = options.etag;
      if (options.lastModified) headers['if-modified-since'] = options.lastModified;

      const response = await request({
        method: 'GET',
        url: checked,
        address: addresses[0]!,
        signal: options.signal,
        headers,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers['location'];
        if (!location || hop === MAX_REDIRECTS) throw new FeedRejected('redirect');
        try {
          url = normaliseFeedUrl(new URL(location, checked).href);
        } catch (error) {
          if (error instanceof FeedRejected) throw error;
          throw new FeedRejected('redirect');
        }
        continue;
      }
      if (response.status === 304) return { status: 304 };
      if (response.status !== 200) throw new FeedRejected('status');

      const type = (response.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
      if (!allowedTypes.includes(type)) throw new FeedRejected('content-type');

      let raw = await readLimited(response.body, options.maxBytes);
      if (response.headers['content-encoding']?.toLowerCase() === 'gzip') {
        try {
          raw = gunzipSync(raw, { maxOutputLength: options.maxBytes });
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          throw new FeedRejected(code === 'ERR_BUFFER_TOO_LARGE' ? 'size' : 'content-type');
        }
      }
      const text = raw.toString('utf8');
      if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new FeedRejected('content-type');
      const etag = response.headers['etag'];
      const lastModified = response.headers['last-modified'];
      return {
        status: 200,
        text,
        ...(etag ? { etag } : {}),
        ...(lastModified ? { lastModified } : {}),
      };
    }
    throw new FeedRejected('redirect');
  };
}
