import state from '../../../backend/test/fixtures/lists/lists.state.sample.json';
import { describe, expect, it, vi } from 'vitest';
import { ListsApiError, listsApi, newId } from './lists';

const ok = (status = 200, body: unknown = state) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const api = (fetchImpl: typeof fetch) => listsApi(fetchImpl);

// Covers: FR-5, FR-7, FR-9, NFR-3, AC-37, AC-45
describe('lists client', () => {
  it('creates a version 4 id without crypto.randomUUID', () => {
    const original = globalThis.crypto.randomUUID;
    // plain HTTP has no randomUUID; the client must not depend on it
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });
    try {
      expect(newId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(newId()).not.toBe(newId());
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: original,
        configurable: true,
      });
    }
  });

  it('reads the full state without caching', async () => {
    const fetchImpl = ok();
    const result = await api(fetchImpl).getLists(new AbortController().signal);
    expect(result.rev).toBe(state.rev);
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe('/api/v1/lists');
    expect(init?.cache).toBe('no-store');
  });

  it('sends JSON for bodies and no content type for bodiless calls', async () => {
    const fetchImpl = ok();
    await api(fetchImpl).createItem({ id: newId(), list: 'shopping', title: 'Milch' });
    await api(fetchImpl).deleteItem('abc');
    const [createUrl, createInit] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(createUrl).toBe('/api/v1/lists/items');
    expect(createInit?.method).toBe('POST');
    expect((createInit?.headers as Record<string, string>)['content-type']).toBe(
      'application/json',
    );
    const [, deleteInit] = vi.mocked(fetchImpl).mock.calls[1]!;
    expect(deleteInit?.method).toBe('DELETE');
    expect(
      (deleteInit?.headers as Record<string, string> | undefined)?.['content-type'],
    ).toBeUndefined();
    expect(deleteInit?.body).toBeUndefined();
  });

  it('uses the documented route for each call', async () => {
    const fetchImpl = ok();
    const client = api(fetchImpl);
    await client.patchItem('i1', { checked: true });
    await client.restoreItem('i1');
    await client.createCategory({ id: 'c1', name: 'Garten' });
    await client.renameCategory('c1', 'Garage');
    await client.deleteCategory('c1');
    await client.restoreCategory('c1');
    expect(
      vi.mocked(fetchImpl).mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`),
    ).toEqual([
      'PATCH /api/v1/lists/items/i1',
      'POST /api/v1/lists/items/i1/restore',
      'POST /api/v1/lists/categories',
      'PATCH /api/v1/lists/categories/c1',
      'DELETE /api/v1/lists/categories/c1',
      'POST /api/v1/lists/categories/c1/restore',
    ]);
  });

  it('maps API errors to their code and marks them as permanent', async () => {
    const error = ok(409, { error: { code: 'CATEGORY_NAME_TAKEN', message: 'x', details: null } });
    await expect(api(error).createCategory({ id: 'c', name: 'a' })).rejects.toMatchObject({
      code: 'CATEGORY_NAME_TAKEN',
      permanent: true,
    });
  });

  it('marks network failures and server errors as retryable and 403 as permanent', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    const failure = await api(down)
      .deleteItem('x')
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ListsApiError);
    expect(failure).toMatchObject({ permanent: false, network: true });
    const server = ok(500, { error: { code: 'INTERNAL_ERROR', message: 'x', details: null } });
    expect(
      await api(server)
        .deleteItem('x')
        .catch((error: unknown) => error),
    ).toMatchObject({ permanent: false });
    const forbidden = ok(403, { error: { code: 'FORBIDDEN_HOST', message: 'x', details: null } });
    expect(
      await api(forbidden)
        .getLists(new AbortController().signal)
        .catch((error: unknown) => error),
    ).toMatchObject({
      permanent: true,
      code: 'FORBIDDEN_HOST',
    });
  });

  it('rejects a response with an unexpected shape as retryable', async () => {
    const odd = ok(200, { nope: true });
    expect(
      await api(odd)
        .deleteItem('x')
        .catch((error: unknown) => error),
    ).toMatchObject({ permanent: false });
  });
});
