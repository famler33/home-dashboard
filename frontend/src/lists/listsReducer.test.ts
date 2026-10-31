import golden from '../../../backend/test/fixtures/lists/lists.state.sample.json';
import { describe, expect, it } from 'vitest';
import type { ListsState } from '../api/lists-types';
import {
  initialModel,
  listsReducer,
  selectView,
  type ListsModel,
  type ListsAction,
} from './listsReducer';

const base = golden as unknown as ListsState;
const at = Date.parse('2026-10-28T10:00:00Z');
const run = (model: ListsModel, ...actions: ListsAction[]) => actions.reduce(listsReducer, model);
const loaded = () => run(initialModel, { type: 'server', state: base, source: 'poll' });
const titles = (model: ListsModel, list: 'shopping' | 'todos') =>
  selectView(model)[list].map((item) => item.title);

// Covers: FR-7, FR-8, NFR-1, AC-42, AC-44, AC-45 (rev and epoch rule, pending queue, rollback)
describe('lists reducer: server states', () => {
  it('starts without data', () => {
    expect(selectView(initialModel)).toMatchObject({ ready: false });
  });

  it('applies a state only when the epoch matches and rev is higher and drops late responses', () => {
    const model = loaded();
    const older = { ...base, rev: base.rev - 1, shopping: [] };
    expect(run(model, { type: 'server', state: older, source: 'poll' }).base).toBe(model.base);
    expect(
      run(model, { type: 'server', state: { ...base, shopping: [] }, source: 'poll' }).base,
    ).toBe(model.base);
    const newer = { ...base, rev: base.rev + 1, shopping: [] };
    expect(
      titles(run(model, { type: 'server', state: newer, source: 'poll' }), 'shopping'),
    ).toEqual([]);
  });

  it('resets its base when the epoch changes even if rev is lower', () => {
    const next = { ...base, epoch: 'other', rev: 0, shopping: [] };
    const model = run(loaded(), { type: 'server', state: next, source: 'poll' });
    expect(model.base?.epoch).toBe('other');
    expect(titles(model, 'shopping')).toEqual([]);
  });

  it('upgrades a summary-derived base to the full state with the same rev', () => {
    const summary = run(initialModel, {
      type: 'server',
      state: base,
      source: 'snapshot',
      partial: true,
    });
    expect(summary.full).toBe(false);
    const full = run(summary, { type: 'server', state: base, source: 'poll' });
    expect(full.full).toBe(true);
  });

  it('holds poll and snapshot states while the user is interacting and applies them afterwards', () => {
    const newer = { ...base, rev: base.rev + 1, shopping: [] };
    const held = run(
      loaded(),
      { type: 'hold', on: true },
      { type: 'server', state: newer, source: 'poll' },
    );
    expect(titles(held, 'shopping')).toEqual(titles(loaded(), 'shopping'));
    const released = run(held, { type: 'hold', on: false });
    expect(titles(released, 'shopping')).toEqual([]);
  });
});

describe('lists reducer: optimistic changes', () => {
  it('shows a new shopping entry on top with a pending mark and clears it on the acknowledgement', () => {
    const op = { kind: 'addItem', id: 'new-1', list: 'shopping', title: 'Käse', at } as const;
    const pending = run(loaded(), { type: 'enqueue', opId: 'op1', op });
    const view = selectView(pending);
    expect(view.shopping[0]).toMatchObject({ id: 'new-1', title: 'Käse', pending: true });
    expect(view.pendingCount).toBe(1);
    const acked = run(pending, {
      type: 'acked',
      opId: 'op1',
      state: {
        ...base,
        rev: base.rev + 1,
        shopping: [
          { id: 'new-1', title: 'Käse', checkedAt: null, createdAt: '' },
          ...base.shopping,
        ],
      },
    });
    expect(selectView(acked).pendingCount).toBe(0);
    expect(selectView(acked).shopping[0]).toMatchObject({ id: 'new-1' });
    expect(selectView(acked).shopping[0]?.pending).toBeFalsy();
  });

  it('sorts a pending to-do by priority and shows checked, changed and removed items before the server answers', () => {
    const model = run(
      loaded(),
      {
        type: 'enqueue',
        opId: 'a',
        op: {
          kind: 'addItem',
          id: 't-new',
          list: 'todo',
          title: 'Dringend',
          categoryId: 'buero',
          priority: 'high',
          at,
        },
      },
      {
        type: 'enqueue',
        opId: 'b',
        op: { kind: 'patchItem', id: base.todos[2]!.id, patch: { checked: true }, at },
      },
      { type: 'enqueue', opId: 'c', op: { kind: 'deleteItem', id: base.todos[1]!.id } },
    );
    const view = selectView(model);
    expect(view.todos.map((todo) => todo.title)).toEqual([
      'Dringend',
      'Verkabelung Schreibtisch',
      'Pflanze leiten',
    ]);
  });

  it('changes priority and fields optimistically and moves a removed category to Sonstiges', () => {
    const todo = base.todos[0]!;
    const model = run(
      loaded(),
      {
        type: 'enqueue',
        opId: 'a',
        op: { kind: 'patchItem', id: todo.id, patch: { priority: 'low', effortHours: null }, at },
      },
      { type: 'enqueue', opId: 'b', op: { kind: 'deleteCategory', id: 'wohnzimmer' } },
    );
    const view = selectView(model);
    expect(view.todos.find((item) => item.id === todo.id)).toMatchObject({
      priority: 'low',
      effortHours: null,
    });
    expect(view.categories.some((category) => category.id === 'wohnzimmer')).toBe(false);
    expect(view.todos.find((item) => item.title === 'Lichtsituation planen')?.categoryId).toBe(
      'sonstiges',
    );
  });

  it('keeps a failed write visible as failed, counts it and retries it', () => {
    const op = { kind: 'addItem', id: 'new-1', list: 'shopping', title: 'Käse', at } as const;
    const failed = run(
      loaded(),
      { type: 'enqueue', opId: 'op1', op },
      { type: 'sending', opId: 'op1' },
      { type: 'failed', opId: 'op1', permanent: false },
    );
    const view = selectView(failed);
    expect(view.failedCount).toBe(1);
    expect(view.shopping[0]).toMatchObject({ id: 'new-1', failed: true });
    const retried = run(failed, { type: 'retry' });
    expect(selectView(retried).failedCount).toBe(0);
    expect(retried.pending[0]?.status).toBe('queued');
  });

  it('rolls a permanently rejected write back and records why', () => {
    const op = { kind: 'addItem', id: 'new-1', list: 'shopping', title: 'Käse', at } as const;
    const model = run(
      loaded(),
      { type: 'enqueue', opId: 'op1', op },
      { type: 'failed', opId: 'op1', permanent: true, code: 'LIST_LIMIT_REACHED' },
    );
    expect(titles(model, 'shopping')).not.toContain('Käse');
    expect(model.notice).toMatchObject({ code: 'LIST_LIMIT_REACHED' });
    expect(run(model, { type: 'dismissNotice' }).notice).toBeNull();
  });

  it('keeps pending writes on top of a new server state', () => {
    const op = { kind: 'addItem', id: 'new-1', list: 'shopping', title: 'Käse', at } as const;
    const model = run(
      loaded(),
      { type: 'enqueue', opId: 'op1', op },
      {
        type: 'server',
        state: { ...base, rev: base.rev + 1 },
        source: 'poll',
      },
    );
    expect(titles(model, 'shopping')[0]).toBe('Käse');
  });
});

describe('lists reducer: views', () => {
  it('counts open and high-priority to-dos from a full state', () => {
    const view = selectView(loaded());
    expect(view.counts).toEqual({ shoppingOpen: 1, todoOpen: 3, todoHigh: 1 });
  });

  it('uses the counts of a summary-derived base', () => {
    const partial = run(initialModel, {
      type: 'server',
      state: base,
      source: 'snapshot',
      partial: true,
      counts: { shoppingOpen: 12, todoOpen: 30, todoHigh: 9 },
    });
    expect(selectView(partial).counts).toEqual({ shoppingOpen: 12, todoOpen: 30, todoHigh: 9 });
  });
});
