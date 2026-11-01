import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { radarDocumentFixture } from './test-data';
import { useRadarDocument } from './useRadarDocument';

const doc = radarDocumentFixture();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

// Covers: FR-7, FR-8, AC-18, AC-19
describe('useRadarDocument', () => {
  it('loads and decodes the document when active', async () => {
    const fetchImpl = vi.fn(async () => json(doc)) as unknown as typeof fetch;
    const { result } = renderHook(() =>
      useRadarDocument({ version: doc.version, enabled: true, fetchImpl }),
    );
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.doc?.version).toBe(doc.version);
    expect(result.current.frames).toHaveLength(5);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/weather/radar',
      expect.objectContaining({ cache: 'no-cache' }),
    );
  });

  it('loads a new document when the snapshot version changes and not otherwise', async () => {
    const fetchImpl = vi.fn(async () => json(doc)) as unknown as typeof fetch;
    const { rerender } = renderHook((props) => useRadarDocument(props), {
      initialProps: { version: 'v1', enabled: true, fetchImpl },
    });
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    rerender({ version: 'v1', enabled: true, fetchImpl });
    rerender({ version: 'v1', enabled: true, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    rerender({ version: 'v2', enabled: true, fetchImpl });
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
  });

  it('keeps the previous document while a newer one loads', async () => {
    let release: (response: Response) => void = () => {};
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(doc))
      .mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve)),
      ) as unknown as typeof fetch;
    const { result, rerender } = renderHook((props) => useRadarDocument(props), {
      initialProps: { version: 'v1', enabled: true, fetchImpl },
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ version: 'v2', enabled: true, fetchImpl });
    expect(result.current.doc?.version).toBe(doc.version);
    await act(async () => release(json({ ...doc, version: 'newer' })));
    await waitFor(() => expect(result.current.doc?.version).toBe('newer'));
  });

  it('does nothing while disabled', () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const { result } = renderHook(() =>
      useRadarDocument({ version: 'v1', enabled: false, fetchImpl }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it.each([
    ['a 404', () => json({ error: { code: 'RADAR_NOT_AVAILABLE' } }, 404)],
    ['a server error', () => json({}, 500)],
    ['a body that is not a radar document', () => json({ hello: 1 })],
  ])('reports unavailable for %s', async (_label, response) => {
    const fetchImpl = vi.fn(async () => response()) as unknown as typeof fetch;
    const { result } = renderHook(() =>
      useRadarDocument({ version: 'v1', enabled: true, fetchImpl }),
    );
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });

  it('reports unavailable for a network failure and aborts on unmount', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    const { result } = renderHook(() =>
      useRadarDocument({ version: 'v1', enabled: true, fetchImpl: failing }),
    );
    await waitFor(() => expect(result.current.status).toBe('unavailable'));

    let signal: AbortSignal | undefined;
    const hanging = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;
    const { unmount } = renderHook(() =>
      useRadarDocument({ version: 'v1', enabled: true, fetchImpl: hanging }),
    );
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
