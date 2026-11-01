import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ListsApiError, listsApi, newId, type ListsApi, type ItemPatch } from '../api/lists';
import { isListsSummary, type ListsState, type ListsSummary } from '../api/lists-types';
import { useSnapshot } from '../snapshot/useSnapshot';
import { ListsContext, type ListsController, type NewTodo } from './lists-context';
import {
  initialModel,
  listsReducer,
  selectView,
  type ListsModel,
  type Operation,
} from './listsReducer';

const POLL_MS = 10_000;
const RETRY_MS = 5_000;

function fromSummary(summary: ListsSummary): ListsState {
  return {
    epoch: summary.epoch,
    rev: summary.rev,
    categories: summary.categories.map((category, index) => ({
      id: category.id,
      name: category.name,
      position: index + 1,
      builtin: category.id === 'sonstiges',
      openTodoCount: 0,
    })),
    shopping: summary.shopping,
    todos: summary.todos,
    suggestions: [],
  };
}

function send(api: ListsApi, op: Operation): Promise<ListsState> {
  switch (op.kind) {
    case 'addItem':
      return api.createItem({
        id: op.id,
        list: op.list,
        title: op.title,
        ...(op.categoryId !== undefined ? { categoryId: op.categoryId } : {}),
        ...(op.priority !== undefined ? { priority: op.priority } : {}),
        ...(op.effortHours !== undefined ? { effortHours: op.effortHours } : {}),
        ...(op.prerequisite !== undefined ? { prerequisite: op.prerequisite } : {}),
      });
    case 'patchItem':
      return api.patchItem(op.id, op.patch);
    case 'deleteItem':
      return api.deleteItem(op.id);
    case 'restoreItem':
      return api.restoreItem(op.id);
    case 'addCategory':
      return api.createCategory({ id: op.id, name: op.name });
    case 'renameCategory':
      return api.renameCategory(op.id, op.name);
    case 'deleteCategory':
      return api.deleteCategory(op.id);
    case 'restoreCategory':
      return api.restoreCategory(op.id);
  }
}

function init(summary: ListsSummary | null): ListsModel {
  if (!summary) return initialModel;
  return listsReducer(initialModel, {
    type: 'server',
    state: fromSummary(summary),
    source: 'snapshot',
    partial: true,
    counts: summary.counts,
  });
}

export function ListsProvider({
  children,
  fetchImpl,
}: {
  children: ReactNode;
  fetchImpl?: typeof fetch;
}) {
  const { snapshot } = useSnapshot();
  const api = useMemo(() => listsApi(fetchImpl), [fetchImpl]);
  const entry = snapshot?.sources.find((source) => source.id === 'lists');
  const summary = entry && isListsSummary(entry.data) ? entry.data : null;
  const [model, dispatch] = useReducer(listsReducer, summary, init);
  const [editors, setEditors] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!summary) return;
    dispatch({
      type: 'server',
      state: fromSummary(summary),
      source: 'snapshot',
      partial: true,
      counts: summary.counts,
    });
  }, [summary]);

  // Changes are sent one after another; a failed one waits for the retry below.
  useEffect(() => {
    if (inFlight.current) return;
    const next = model.pending.find((entryOp) => entryOp.status === 'queued');
    if (!next) return;
    inFlight.current = true;
    dispatch({ type: 'sending', opId: next.opId });
    void (async () => {
      try {
        const state = await send(api, next.op);
        inFlight.current = false;
        dispatch({ type: 'acked', opId: next.opId, state });
      } catch (error) {
        inFlight.current = false;
        const permanent = error instanceof ListsApiError && error.permanent;
        dispatch({
          type: 'failed',
          opId: next.opId,
          permanent,
          ...(error instanceof ListsApiError && error.code ? { code: error.code } : {}),
        });
      }
    })();
  }, [model.pending, api]);

  const hasFailed = model.pending.some((entryOp) => entryOp.status === 'failed');
  useEffect(() => {
    if (!hasFailed) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'retry' }), RETRY_MS);
    return () => clearTimeout(timer);
  }, [hasFailed, model.pending]);

  useEffect(() => {
    const retry = () => dispatch({ type: 'retry' });
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    if (editors === 0) return undefined;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const state = await api.getLists(controller.signal);
        dispatch({ type: 'server', state, source: 'poll' });
      } catch {
        // a failed poll changes nothing; the next one tries again
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [editors, api]);

  const enqueue = useCallback(
    (op: Operation) => dispatch({ type: 'enqueue', opId: newId(), op }),
    [],
  );
  const registerEditor = useCallback(() => {
    setEditors((count) => count + 1);
    return () => setEditors((count) => count - 1);
  }, []);

  const view = useMemo(() => selectView(model), [model]);
  const controller = useMemo<ListsController>(
    () => ({
      view,
      addShopping(title) {
        const text = title.trim();
        if (text === '') return '';
        const id = newId();
        enqueue({ kind: 'addItem', id, list: 'shopping', title: text, at: Date.now() });
        return id;
      },
      addTodo(input: NewTodo) {
        const title = input.title.trim();
        if (title === '') return '';
        const id = newId();
        enqueue({
          kind: 'addItem',
          id,
          list: 'todo',
          title,
          categoryId: input.categoryId,
          priority: input.priority ?? 'medium',
          effortHours: input.effortHours ?? null,
          prerequisite: input.prerequisite?.trim() ? input.prerequisite.trim() : null,
          at: Date.now(),
        });
        return id;
      },
      patch: (id: string, patch: ItemPatch) =>
        enqueue({ kind: 'patchItem', id, patch, at: Date.now() }),
      remove: (id) => enqueue({ kind: 'deleteItem', id }),
      restore: (id) => enqueue({ kind: 'restoreItem', id }),
      addCategory(name) {
        const id = newId();
        enqueue({ kind: 'addCategory', id, name: name.trim() });
        return id;
      },
      renameCategory: (id, name) => enqueue({ kind: 'renameCategory', id, name: name.trim() }),
      removeCategory: (id) => enqueue({ kind: 'deleteCategory', id }),
      restoreCategory: (id) => enqueue({ kind: 'restoreCategory', id }),
      retry: () => dispatch({ type: 'retry' }),
      dismissNotice: () => dispatch({ type: 'dismissNotice' }),
      setHold: (on) => dispatch({ type: 'hold', on }),
      registerEditor,
    }),
    [view, enqueue, registerEditor],
  );

  return <ListsContext.Provider value={controller}>{children}</ListsContext.Provider>;
}
