export class UpstreamError extends Error {
  constructor(message = 'upstream request failed') {
    super(message);
    this.name = 'UpstreamError';
  }
}

/** Home coordinates are rounded to about one kilometre before they leave the NAS. */
export function roundForUpstream(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface GetJsonOptions {
  signal: AbortSignal;
  userAgent: string;
  maxBytes: number;
}

function isAbort(error: unknown): error is Error {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

export async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new UpstreamError();
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new UpstreamError();
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/**
 * Guarded JSON GET: identifying user agent, no cookies, no referrer, no redirects, a size
 * limit, and errors that never carry the URL, the query string or upstream text.
 */
export async function getJson(
  fetchImpl: typeof fetch,
  url: URL,
  options: GetJsonOptions,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: options.signal,
      headers: { 'user-agent': options.userAgent, accept: 'application/json' },
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new UpstreamError();
  }
  if (!response.ok) throw new UpstreamError();

  try {
    const bytes = await readLimited(response, options.maxBytes);
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch (error) {
    if (isAbort(error) || error instanceof UpstreamError) throw error;
    throw new UpstreamError();
  }
}
