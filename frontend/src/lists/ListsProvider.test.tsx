import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import golden from '../../../backend/test/fixtures/lists/lists.state.sample.json';
import snapshotJson from '../../../backend/test/fixtures/lists/lists.snapshot.sample.json';
import type { Snapshot } from '../api/types';
import type { ListsState } from '../api/lists-types';
import { SnapshotContext } from '../snapshot/snapshot-context';
import { contextFixture } from '../test-utils';
import { ListsProvider } from './ListsProvider';
import { useLists, useListsEditor, type ListsController } from './lists-context';

const state = golden as unknown as ListsState;
const snapshot = snapshotJson as unknown as Snapshot;
const held: { current: ListsController | null } = { current: null };
const controller = new Proxy({} as ListsController, {
  get: (_target, key) => (held.current as unknown as Record<string | symbol, unknown>)[key],
});

function Probe() {
  const lists = useLists();
  useEffect(() => {
    held.current = lists;
  });
  return (
    <p data-testid="probe">{`${lists.view.shopping.map((item) => item.title).join(',')}|${lists.view.pendingCount}|${lists.view.failedCount}`}</p>
  );
}
function Editor() {
  useListsEditor();
  return null;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const withItem = (title: string, id: string, rev: number): ListsState => ({
  ...state,
  rev,
  shopping: [
    { id, title, checkedAt: null, createdAt: '2026-10-28T10:30:00.000Z' },
    ...state.shopping,
  ],
});

function show(fetchImpl: typeof fetch, editor = false) {
  return render(
    <SnapshotContext.Provider value={contextFixture(snapshot)}>
      <ListsProvider fetchImpl={fetchImpl}>
        <Probe />
        {editor && <Editor />}
      </ListsProvider>
    </SnapshotContext.Provider>,
  );
}
const flush = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
};
const probe = () => screen.getByTestId('probe').textContent;

beforeEach(() =>
  vi.useFakeTimers({
    now: Date.parse('2026-10-28T10:30:00Z'),
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  }),
);
afterEach(() => vi.useRealTimers());

// Covers: FR-7, FR-8, NFR-1, NFR-4, AC-37, AC-41, AC-42, AC-43, AC-44, AC-45
describe('ListsProvider', () => {
  it('reads the tile data from the lists entry of the snapshot', () => {
    show(vi.fn() as unknown as typeof fetch);
    expect(controller.view.ready).toBe(true);
    expect(controller.view.counts).toEqual({ shoppingOpen: 1, todoOpen: 3, todoHigh: 1 });
    expect(probe()).toBe('Eier,Brot|0|0');
  });

  it('shows a new entry at once with a pending mark and clears it when the server answers', async () => {
    const fetchImpl = vi.fn(async () =>
      json(withItem('Käse', 'x', state.rev + 1), 201),
    ) as unknown as typeof fetch;
    show(fetchImpl);
    act(() => controller.addShopping('Käse'));
    expect(probe()).toBe('Käse,Eier,Brot|1|0');
    await flush();
    expect(probe()).toBe('Käse,Eier,Brot|0|0');
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(url).toBe('/api/v1/lists/items');
    const body = JSON.parse(String(init?.body)) as { id: string; list: string; title: string };
    expect(body).toMatchObject({ list: 'shopping', title: 'Käse' });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a failed write visible as not saved and retries it automatically with the same id', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('network');
      return json(withItem('Käse', 'x', state.rev + 1), 201);
    }) as unknown as typeof fetch;
    show(fetchImpl);
    act(() => controller.addShopping('Käse'));
    await flush();
    expect(probe()).toBe('Käse,Eier,Brot|0|1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    await flush();
    expect(probe()).toBe('Käse,Eier,Brot|0|0');
    const ids = vi
      .mocked(fetchImpl)
      .mock.calls.map(([, init]) => (JSON.parse(String(init?.body)) as { id: string }).id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
  });

  it('retries failed writes when the connection comes back', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('network');
      return json(withItem('Käse', 'x', state.rev + 1), 201);
    }) as unknown as typeof fetch;
    show(fetchImpl);
    act(() => controller.addShopping('Käse'));
    await flush();
    act(() => void window.dispatchEvent(new Event('online')));
    await flush();
    expect(probe()).toBe('Käse,Eier,Brot|0|0');
  });

  it('rolls a rejected write back and says why', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ error: { code: 'LIST_LIMIT_REACHED', message: 'x', details: null } }, 409),
    ) as unknown as typeof fetch;
    show(fetchImpl);
    act(() => controller.addShopping('Käse'));
    await flush();
    expect(probe()).toBe('Eier,Brot|0|0');
    expect(controller.view.notice).toMatchObject({ code: 'LIST_LIMIT_REACHED' });
  });

  it('removes an entry and restores it with undo', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ ...state, rev: state.rev + 1 }),
    ) as unknown as typeof fetch;
    show(fetchImpl);
    const eggs = state.shopping[0]!;
    act(() => controller.remove(eggs.id));
    expect(probe()).toBe('Brot|1|0');
    await flush();
    act(() => controller.restore(eggs.id));
    await flush();
    const calls = vi
      .mocked(fetchImpl)
      .mock.calls.map(([url, init]) => `${init?.method} ${String(url).replace(eggs.id, ':id')}`);
    expect(calls).toEqual([
      'DELETE /api/v1/lists/items/:id',
      'POST /api/v1/lists/items/:id/restore',
    ]);
  });

  it('polls the full state every 10 seconds only while an editor is mounted', async () => {
    const fetchImpl = vi.fn(async () => json(state)) as unknown as typeof fetch;
    const { unmount } = show(fetchImpl, true);
    await flush();
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
    expect(controller.view.full).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(vi.mocked(fetchImpl).mock.calls.length).toBeGreaterThanOrEqual(3);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not poll without an editor', async () => {
    const fetchImpl = vi.fn(async () => json(state)) as unknown as typeof fetch;
    show(fetchImpl);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled();
  });

  it('holds incoming states while the user interacts and applies them afterwards', async () => {
    let answer: ListsState = state;
    const fetchImpl = vi.fn(async () => json(answer)) as unknown as typeof fetch;
    show(fetchImpl, true);
    await flush();
    act(() => controller.setHold(true));
    answer = withItem('Neu', 'n', state.rev + 5);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(probe()).toBe('Eier,Brot|0|0');
    act(() => controller.setHold(false));
    expect(probe()).toBe('Neu,Eier,Brot|0|0');
  });

  it('adds, renames, removes and restores categories through the routes', async () => {
    const fetchImpl = vi.fn(async () => json(state)) as unknown as typeof fetch;
    show(fetchImpl);
    act(() => {
      controller.addCategory('Garten');
      controller.renameCategory('balkon', 'Terrasse');
      controller.removeCategory('balkon');
      controller.restoreCategory('balkon');
    });
    await flush();
    const calls = vi
      .mocked(fetchImpl)
      .mock.calls.map(([url, init]) => `${init?.method} ${String(url)}`);
    expect(calls).toEqual([
      'POST /api/v1/lists/categories',
      'PATCH /api/v1/lists/categories/balkon',
      'DELETE /api/v1/lists/categories/balkon',
      'POST /api/v1/lists/categories/balkon/restore',
    ]);
  });

  it('sends changes one after another in order', async () => {
    const order: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      order.push(String(init?.method));
      return json(state);
    }) as unknown as typeof fetch;
    show(fetchImpl);
    act(() => {
      controller.addShopping('A');
      controller.patch(state.shopping[0]!.id, { checked: true });
      controller.remove(state.shopping[1]!.id);
    });
    await flush();
    expect(order).toEqual(['POST', 'PATCH', 'DELETE']);
  });
});
