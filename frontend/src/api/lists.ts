import { isListsState, type ListsState, type Priority } from './lists-types';

export class ListsApiError extends Error {
  constructor(
    readonly code: string | null,
    readonly status: number | null,
    /** A permanent error will not succeed when sent again (validation, forbidden, not found). */
    readonly permanent: boolean,
    readonly network: boolean,
  ) {
    super(code ?? (network ? 'NETWORK' : 'LISTS_REQUEST_FAILED'));
    this.name = 'ListsApiError';
  }
}

/**
 * A version 4 id. `crypto.randomUUID` only exists in secure contexts and the wall display runs
 * over plain HTTP, so the id is built from `getRandomValues`.
 */
export function newId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface NewItem {
  id: string;
  list: 'shopping' | 'todo';
  title: string;
  categoryId?: string;
  priority?: Priority;
  effortHours?: number | null;
  prerequisite?: string | null;
}

export interface ItemPatch {
  title?: string;
  checked?: boolean;
  categoryId?: string;
  priority?: Priority;
  effortHours?: number | null;
  prerequisite?: string | null;
}

export function listsApi(fetchImpl: typeof fetch = fetch) {
  async function request(
    method: string,
    url: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<ListsState> {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        cache: 'no-store',
        ...(body === undefined
          ? {}
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ListsApiError(null, null, false, true);
    }

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code =
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? String((payload as { error: { code?: unknown } }).error?.code ?? '') || null
          : null;
      const permanent =
        response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
      throw new ListsApiError(code, response.status, permanent, false);
    }
    if (!isListsState(payload)) throw new ListsApiError(null, response.status, false, false);
    return payload;
  }

  return {
    getLists: (signal: AbortSignal) => request('GET', '/api/v1/lists', undefined, signal),
    createItem: (item: NewItem) => request('POST', '/api/v1/lists/items', item),
    patchItem: (id: string, patch: ItemPatch) =>
      request('PATCH', `/api/v1/lists/items/${id}`, patch),
    deleteItem: (id: string) => request('DELETE', `/api/v1/lists/items/${id}`),
    restoreItem: (id: string) => request('POST', `/api/v1/lists/items/${id}/restore`),
    createCategory: (input: { id: string; name: string }) =>
      request('POST', '/api/v1/lists/categories', input),
    renameCategory: (id: string, name: string) =>
      request('PATCH', `/api/v1/lists/categories/${id}`, { name }),
    deleteCategory: (id: string) => request('DELETE', `/api/v1/lists/categories/${id}`),
    restoreCategory: (id: string) => request('POST', `/api/v1/lists/categories/${id}/restore`),
  };
}

export type ListsApi = ReturnType<typeof listsApi>;
