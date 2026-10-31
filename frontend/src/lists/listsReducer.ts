import type {
  ListsCategory,
  ListsCounts,
  ListsState,
  ShoppingItem,
  TodoItem,
  Priority,
} from '../api/lists-types';

export type Operation =
  | {
      kind: 'addItem';
      id: string;
      list: 'shopping' | 'todo';
      title: string;
      categoryId?: string;
      priority?: Priority;
      effortHours?: number | null;
      prerequisite?: string | null;
      at: number;
    }
  | {
      kind: 'patchItem';
      id: string;
      patch: {
        title?: string;
        checked?: boolean;
        categoryId?: string;
        priority?: Priority;
        effortHours?: number | null;
        prerequisite?: string | null;
      };
      at: number;
    }
  | { kind: 'deleteItem'; id: string }
  | { kind: 'restoreItem'; id: string }
  | { kind: 'addCategory'; id: string; name: string }
  | { kind: 'renameCategory'; id: string; name: string }
  | { kind: 'deleteCategory'; id: string }
  | { kind: 'restoreCategory'; id: string };

export interface PendingOp {
  opId: string;
  op: Operation;
  status: 'queued' | 'sending' | 'failed';
  attempts: number;
}

export interface ListsNotice {
  code: string;
  opId: string;
}

interface HeldState {
  state: ListsState;
  partial: boolean;
  counts: ListsCounts | undefined;
}

export interface ListsModel {
  base: ListsState | null;
  /** The base came from the full state (suggestions, all rows), not from the snapshot summary. */
  full: boolean;
  counts: ListsCounts | undefined;
  pending: PendingOp[];
  notice: ListsNotice | null;
  hold: boolean;
  held: HeldState | null;
}

export type ListsAction =
  | {
      type: 'server';
      state: ListsState;
      source: 'poll' | 'snapshot' | 'mutation';
      partial?: boolean;
      counts?: ListsCounts;
    }
  | { type: 'enqueue'; opId: string; op: Operation }
  | { type: 'sending'; opId: string }
  | { type: 'acked'; opId: string; state: ListsState }
  | { type: 'failed'; opId: string; permanent: boolean; code?: string }
  | { type: 'retry'; opId?: string }
  | { type: 'hold'; on: boolean }
  | { type: 'dismissNotice' };

export const initialModel: ListsModel = {
  base: null,
  full: false,
  counts: undefined,
  pending: [],
  notice: null,
  hold: false,
  held: null,
};

function accepts(model: ListsModel, state: ListsState, partial: boolean): boolean {
  if (!model.base) return true;
  if (model.base.epoch !== state.epoch) return true;
  if (state.rev > model.base.rev) return true;
  return state.rev === model.base.rev && !model.full && !partial;
}

function apply(model: ListsModel, held: HeldState): ListsModel {
  if (!accepts(model, held.state, held.partial)) return model;
  return { ...model, base: held.state, full: !held.partial, counts: held.counts, held: null };
}

export function listsReducer(model: ListsModel, action: ListsAction): ListsModel {
  switch (action.type) {
    case 'server': {
      const incoming: HeldState = {
        state: action.state,
        partial: action.partial ?? false,
        counts: action.counts,
      };
      if (model.hold && action.source !== 'mutation') {
        const kept = model.held;
        if (
          kept &&
          kept.state.epoch === incoming.state.epoch &&
          kept.state.rev >= incoming.state.rev
        ) {
          return model;
        }
        return { ...model, held: incoming };
      }
      return apply(model, incoming);
    }
    case 'enqueue':
      return {
        ...model,
        pending: [
          ...model.pending,
          { opId: action.opId, op: action.op, status: 'queued', attempts: 0 },
        ],
      };
    case 'sending':
      return {
        ...model,
        pending: model.pending.map((entry) =>
          entry.opId === action.opId
            ? { ...entry, status: 'sending', attempts: entry.attempts + 1 }
            : entry,
        ),
      };
    case 'acked': {
      const pending = model.pending.filter((entry) => entry.opId !== action.opId);
      return apply(
        { ...model, pending },
        { state: action.state, partial: false, counts: undefined },
      );
    }
    case 'failed': {
      if (action.permanent) {
        return {
          ...model,
          pending: model.pending.filter((entry) => entry.opId !== action.opId),
          notice: { code: action.code ?? 'LISTS_REQUEST_FAILED', opId: action.opId },
        };
      }
      return {
        ...model,
        pending: model.pending.map((entry) =>
          entry.opId === action.opId ? { ...entry, status: 'failed' } : entry,
        ),
      };
    }
    case 'retry':
      return {
        ...model,
        pending: model.pending.map((entry) =>
          entry.status === 'failed' && (action.opId === undefined || entry.opId === action.opId)
            ? { ...entry, status: 'queued' }
            : entry,
        ),
      };
    case 'hold': {
      if (action.on) return { ...model, hold: true };
      const released: ListsModel = { ...model, hold: false };
      return model.held ? apply(released, model.held) : released;
    }
    case 'dismissNotice':
      return { ...model, notice: null };
  }
}

export interface MarkedShopping extends ShoppingItem {
  pending?: boolean;
  failed?: boolean;
}
export interface MarkedTodo extends TodoItem {
  pending?: boolean;
  failed?: boolean;
}

export interface ListsView {
  ready: boolean;
  full: boolean;
  epoch: string;
  rev: number;
  categories: ListsCategory[];
  shopping: MarkedShopping[];
  todos: MarkedTodo[];
  suggestions: string[];
  counts: ListsCounts;
  pendingCount: number;
  failedCount: number;
  notice: ListsNotice | null;
}

const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const emptyCounts: ListsCounts = { shoppingOpen: 0, todoOpen: 0, todoHigh: 0 };
const iso = (ms: number): string => new Date(ms).toISOString();

export function selectView(model: ListsModel): ListsView {
  if (!model.base) {
    return {
      ready: false,
      full: false,
      epoch: '',
      rev: 0,
      categories: [],
      shopping: [],
      todos: [],
      suggestions: [],
      counts: emptyCounts,
      pendingCount: 0,
      failedCount: 0,
      notice: model.notice,
    };
  }

  let categories = model.base.categories.map((category) => ({ ...category }));
  let shopping: MarkedShopping[] = model.base.shopping.map((item) => ({ ...item }));
  let todos: MarkedTodo[] = model.base.todos.map((item) => ({ ...item }));
  const touched = new Map<string, 'pending' | 'failed'>();
  const mark = (id: string, status: PendingOp['status']) => {
    if (touched.get(id) === 'failed') return;
    touched.set(id, status === 'failed' ? 'failed' : 'pending');
  };

  for (const entry of model.pending) {
    const op = entry.op;
    switch (op.kind) {
      case 'addItem': {
        if (shopping.some((item) => item.id === op.id) || todos.some((item) => item.id === op.id))
          break;
        if (op.list === 'shopping') {
          shopping = [
            { id: op.id, title: op.title, checkedAt: null, createdAt: iso(op.at) },
            ...shopping,
          ];
        } else {
          todos = [
            ...todos,
            {
              id: op.id,
              title: op.title,
              categoryId: op.categoryId ?? 'sonstiges',
              priority: op.priority ?? 'medium',
              effortHours: op.effortHours ?? null,
              prerequisite: op.prerequisite ?? null,
              checkedAt: null,
              createdAt: iso(op.at),
            },
          ];
        }
        mark(op.id, entry.status);
        break;
      }
      case 'patchItem': {
        const patch = op.patch;
        const change = <T extends ShoppingItem | TodoItem>(item: T): T => {
          if (item.id !== op.id) return item;
          mark(op.id, entry.status);
          return {
            ...item,
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.checked !== undefined
              ? { checkedAt: patch.checked ? iso(op.at) : null }
              : {}),
            ...('categoryId' in item && patch.categoryId !== undefined
              ? { categoryId: patch.categoryId }
              : {}),
            ...('priority' in item && patch.priority !== undefined
              ? { priority: patch.priority }
              : {}),
            ...('effortHours' in item && patch.effortHours !== undefined
              ? { effortHours: patch.effortHours }
              : {}),
            ...('prerequisite' in item && patch.prerequisite !== undefined
              ? { prerequisite: patch.prerequisite }
              : {}),
          };
        };
        shopping = shopping.map(change);
        todos = todos.map(change);
        break;
      }
      case 'deleteItem':
        shopping = shopping.filter((item) => item.id !== op.id);
        todos = todos.filter((item) => item.id !== op.id);
        break;
      case 'addCategory':
        if (!categories.some((category) => category.id === op.id)) {
          categories = [
            ...categories,
            {
              id: op.id,
              name: op.name,
              position: Math.max(0, ...categories.map((category) => category.position)) + 1,
              builtin: false,
              openTodoCount: 0,
            },
          ];
        }
        break;
      case 'renameCategory':
        categories = categories.map((category) =>
          category.id === op.id ? { ...category, name: op.name } : category,
        );
        break;
      case 'deleteCategory':
        categories = categories.filter((category) => category.id !== op.id);
        todos = todos.map((todo) =>
          todo.categoryId === op.id ? { ...todo, categoryId: 'sonstiges' } : todo,
        );
        break;
      case 'restoreItem':
      case 'restoreCategory':
        break;
    }
  }

  const open = shopping.filter((item) => item.checkedAt === null);
  const checked = shopping
    .filter((item) => item.checkedAt !== null)
    .sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''));
  shopping = [...open, ...checked].map((item) => flag(item, touched));

  const order = new Map(todos.map((todo, index) => [todo.id, index]));
  todos = [...todos]
    .sort(
      (a, b) =>
        Number(a.checkedAt !== null) - Number(b.checkedAt !== null) ||
        rank[a.priority] - rank[b.priority] ||
        a.createdAt.localeCompare(b.createdAt) ||
        (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    )
    .map((item) => flag(item, touched));

  const openTodos = new Map<string, number>();
  for (const todo of todos) {
    if (todo.checkedAt === null)
      openTodos.set(todo.categoryId, (openTodos.get(todo.categoryId) ?? 0) + 1);
  }
  categories = categories.map((category) => ({
    ...category,
    openTodoCount: openTodos.get(category.id) ?? 0,
  }));

  const counts: ListsCounts =
    !model.full && model.counts
      ? model.counts
      : {
          shoppingOpen: shopping.filter((item) => item.checkedAt === null).length,
          todoOpen: todos.filter((item) => item.checkedAt === null).length,
          todoHigh: todos.filter((item) => item.checkedAt === null && item.priority === 'high')
            .length,
        };

  return {
    ready: true,
    full: model.full,
    epoch: model.base.epoch,
    rev: model.base.rev,
    categories,
    shopping,
    todos,
    suggestions: model.base.suggestions,
    counts,
    pendingCount: model.pending.filter((entry) => entry.status !== 'failed').length,
    failedCount: model.pending.filter((entry) => entry.status === 'failed').length,
    notice: model.notice,
  };
}

function flag<T extends { id: string }>(
  item: T,
  touched: Map<string, 'pending' | 'failed'>,
): T & { pending?: boolean; failed?: boolean } {
  const state = touched.get(item.id);
  if (state === 'failed') return { ...item, failed: true };
  if (state === 'pending') return { ...item, pending: true };
  return item;
}
