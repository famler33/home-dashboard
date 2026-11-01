import { readLimited, UpstreamError } from '../weather/http.js';

export interface GetTextOptions {
  signal: AbortSignal;
  userAgent: string;
  maxBytes: number;
}

function isAbort(error: unknown): error is Error {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/**
 * Guarded XML GET: identifying user agent, no cookies, no referrer, no redirects, a size limit,
 * and errors that never carry the URL or upstream text.
 */
export async function getText(
  fetchImpl: typeof fetch,
  url: URL,
  options: GetTextOptions,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: options.signal,
      headers: {
        'user-agent': options.userAgent,
        accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new UpstreamError();
  }
  if (!response.ok) throw new UpstreamError();
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('xml')) {
    throw new UpstreamError();
  }

  try {
    const bytes = await readLimited(response, options.maxBytes);
    return new TextDecoder().decode(bytes);
  } catch (error) {
    if (isAbort(error) || error instanceof UpstreamError) throw error;
    throw new UpstreamError();
  }
}
