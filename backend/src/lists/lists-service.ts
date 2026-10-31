import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { SnapshotStore } from '../cache/snapshot-store.js';
import type { ApiErrorCode } from '../errors.js';
import { keyOf, sanitiseText } from './lists-text.js';
import type {
  AddItemInput,
  ListsCategory,
  ListsState,
  ListsSummary,
  PatchItemInput,
  Priority,
  ShoppingItem,
  TodoItem,
} from './lists-types.js';

const TITLE_MAX = 80;
const NAME_MAX = 20;
const MAX_OPEN_PER_LIST = 500;
const MAX_ROWS_PER_LIST = 600;
const MAX_CATEGORIES = 100;
const TOMBSTONE_MS = 60 * 60_000;
const SUMMARY_SHOPPING = 30;
const SUMMARY_TODOS = 40;
const SUGGESTIONS = 100;
const FALLBACK_CATEGORY = 'sonstiges';
const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

type ListsErrorCode = Extract<
  ApiErrorCode,
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'LIST_LIMIT_REACHED'
  | 'CATEGORY_NAME_TAKEN'
  | 'CATEGORY_PROTECTED'
>;

export class ListsError extends Error {
  constructor(readonly code: ListsErrorCode) {
    super(code);
    this.name = 'ListsError';
  }
}

export interface ListsService {
  state(): ListsState;
  summary(): ListsSummary;
  addItem(input: AddItemInput): { state: ListsState; created: boolean };
  patchItem(id: string, input: PatchItemInput): ListsState;
  deleteItem(id: string): ListsState;
  restoreItem(id: string): ListsState;
  addCategory(input: { id: string; name: string }): { state: ListsState; created: boolean };
  renameCategory(id: string, name: string): ListsState;
  deleteCategory(id: string): ListsState;
  restoreCategory(id: string): ListsState;
  purge(now: number): void;
}

interface ItemRow {
  id: string;
  list: 'shopping' | 'todo';
  title: string;
  title_key: string;
  eff_category: string | null;
  priority: Priority | null;
  effort_hours: number | null;
  prerequisite: string | null;
  checked_at: number | null;
  created_at: number;
  seq: number;
}

function localDate(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function validEffort(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 99 && Number.isInteger(value * 2);
}

export function createListsService(deps: {
  db: Database.Database;
  store: SnapshotStore;
  now: () => number;
  timezone: string;
  epoch?: string;
}): ListsService {
  const { db, store, timezone } = deps;
  const epoch = deps.epoch ?? randomUUID();

  const itemRows = db.prepare(
    `SELECT i.id, i.list, i.title, i.title_key, i.priority, i.effort_hours, i.prerequisite,
            i.checked_at, i.created_at, i.rowid AS seq,
            CASE WHEN c.id IS NOT NULL AND c.deleted_at IS NULL THEN i.category_id
                 WHEN i.list = 'todo' THEN '${FALLBACK_CATEGORY}' END AS eff_category
       FROM list_items i LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.deleted_at IS NULL`,
  );
  const categoryRows = db.prepare(
    'SELECT id, name, position, builtin FROM categories WHERE deleted_at IS NULL ORDER BY position, rowid',
  );
  const historyRows = db.prepare(
    'SELECT title, title_key FROM shopping_history ORDER BY last_used DESC, rowid DESC LIMIT 400',
  );
  const getRev = db.prepare("SELECT value FROM meta WHERE key = 'rev'");
  const setRev = db.prepare("UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'rev'");

  const iso = (ms: number | null): string | null =>
    ms === null ? null : new Date(ms).toISOString();

  function buildState(): ListsState {
    const rows = itemRows.all() as ItemRow[];
    const byNewest = (a: ItemRow, b: ItemRow) => b.created_at - a.created_at || b.seq - a.seq;
    const shopping = rows
      .filter((row) => row.list === 'shopping')
      .sort((a, b) => {
        const open = Number(a.checked_at !== null) - Number(b.checked_at !== null);
        if (open !== 0) return open;
        return a.checked_at === null ? byNewest(a, b) : (b.checked_at ?? 0) - (a.checked_at ?? 0);
      })
      .map<ShoppingItem>((row) => ({
        id: row.id,
        title: row.title,
        checkedAt: iso(row.checked_at),
        createdAt: iso(row.created_at) ?? '',
      }));
    const todoRows = rows
      .filter((row) => row.list === 'todo')
      .sort((a, b) => {
        const open = Number(a.checked_at !== null) - Number(b.checked_at !== null);
        if (open !== 0) return open;
        return (
          priorityRank[a.priority ?? 'medium'] - priorityRank[b.priority ?? 'medium'] ||
          a.created_at - b.created_at ||
          a.seq - b.seq
        );
      });
    const todos = todoRows.map<TodoItem>((row) => ({
      id: row.id,
      title: row.title,
      categoryId: row.eff_category ?? FALLBACK_CATEGORY,
      priority: row.priority ?? 'medium',
      effortHours: row.effort_hours,
      prerequisite: row.prerequisite,
      checkedAt: iso(row.checked_at),
      createdAt: iso(row.created_at) ?? '',
    }));
    const openTodos = new Map<string, number>();
    for (const todo of todos) {
      if (todo.checkedAt === null)
        openTodos.set(todo.categoryId, (openTodos.get(todo.categoryId) ?? 0) + 1);
    }
    const categories = (
      categoryRows.all() as { id: string; name: string; position: number; builtin: number }[]
    ).map<ListsCategory>((row) => ({
      id: row.id,
      name: row.name,
      position: row.position,
      builtin: row.builtin === 1,
      openTodoCount: openTodos.get(row.id) ?? 0,
    }));
    const openKeys = new Set(
      rows
        .filter((row) => row.list === 'shopping' && row.checked_at === null)
        .map((row) => row.title_key),
    );
    const suggestions: string[] = [];
    for (const row of historyRows.all() as { title: string; title_key: string }[]) {
      if (!openKeys.has(row.title_key)) suggestions.push(row.title);
      if (suggestions.length === SUGGESTIONS) break;
    }
    return {
      epoch,
      rev: Number((getRev.get() as { value: string }).value),
      categories,
      shopping,
      todos,
      suggestions,
    };
  }

  function buildSummary(state: ListsState = buildState()): ListsSummary {
    return {
      epoch,
      rev: state.rev,
      truncated: state.shopping.length > SUMMARY_SHOPPING || state.todos.length > SUMMARY_TODOS,
      categories: state.categories.map((category) => ({ id: category.id, name: category.name })),
      shopping: state.shopping.slice(0, SUMMARY_SHOPPING),
      todos: state.todos.slice(0, SUMMARY_TODOS),
      counts: {
        shoppingOpen: state.shopping.filter((item) => item.checkedAt === null).length,
        todoOpen: state.todos.filter((item) => item.checkedAt === null).length,
        todoHigh: state.todos.filter((item) => item.checkedAt === null && item.priority === 'high')
          .length,
      },
    };
  }

  function publish(): ListsState {
    setRev.run();
    const state = buildState();
    store.recordSuccess('lists', buildSummary(state), deps.now());
    return state;
  }

  /** Removes checked entries of earlier local days and tombstones older than one hour. */
  function purgeInternal(now: number): boolean {
    let changed = false;
    const today = localDate(now, timezone);
    const checked = db
      .prepare('SELECT id, checked_at FROM list_items WHERE checked_at IS NOT NULL')
      .all() as { id: string; checked_at: number }[];
    const remove = db.prepare('DELETE FROM list_items WHERE id = ?');
    for (const row of checked) {
      if (localDate(row.checked_at, timezone) < today) {
        remove.run(row.id);
        changed = true;
      }
    }
    const cutoff = now - TOMBSTONE_MS;
    changed =
      db
        .prepare('DELETE FROM list_items WHERE deleted_at IS NOT NULL AND deleted_at < ?')
        .run(cutoff).changes > 0 || changed;
    const expired = db
      .prepare('SELECT id FROM categories WHERE deleted_at IS NOT NULL AND deleted_at < ?')
      .all(cutoff) as { id: string }[];
    for (const category of expired) {
      db.prepare('UPDATE list_items SET category_id = ? WHERE category_id = ?').run(
        FALLBACK_CATEGORY,
        category.id,
      );
      db.prepare('DELETE FROM categories WHERE id = ?').run(category.id);
      changed = true;
    }
    return changed;
  }

  /** Runs a mutation in one transaction with the purge, the rev bump and the published summary. */
  function mutate<T>(
    action: (now: number) => { changed: boolean; value: (state: ListsState) => T },
  ): T {
    return db.transaction(() => {
      const now = deps.now();
      const purged = purgeInternal(now);
      const result = action(now);
      const state = result.changed || purged ? publish() : buildState();
      return result.value(state);
    })();
  }

  const counts = {
    open: db.prepare('SELECT COUNT(*) AS n FROM list_items WHERE list = ? AND deleted_at IS NULL'),
    rows: db.prepare('SELECT COUNT(*) AS n FROM list_items WHERE list = ?'),
    categories: db.prepare('SELECT COUNT(*) AS n FROM categories WHERE deleted_at IS NULL'),
  };
  const n = (statement: Database.Statement, ...args: unknown[]): number =>
    (statement.get(...args) as { n: number }).n;

  function assertRoom(list: 'shopping' | 'todo'): void {
    if (n(counts.open, list) >= MAX_OPEN_PER_LIST || n(counts.rows, list) >= MAX_ROWS_PER_LIST) {
      throw new ListsError('LIST_LIMIT_REACHED');
    }
  }

  function activeCategory(id: string): boolean {
    return (
      db.prepare('SELECT 1 FROM categories WHERE id = ? AND deleted_at IS NULL').get(id) !==
      undefined
    );
  }

  function findItem(
    id: string,
  ): { list: 'shopping' | 'todo'; deleted_at: number | null } | undefined {
    return db.prepare('SELECT list, deleted_at FROM list_items WHERE id = ?').get(id) as
      { list: 'shopping' | 'todo'; deleted_at: number | null } | undefined;
  }

  function cleanText(raw: unknown, max: number): string {
    const text = typeof raw === 'string' ? sanitiseText(raw, max) : null;
    if (text === null) throw new ListsError('VALIDATION_FAILED');
    return text;
  }

  function cleanPrerequisite(raw: string | null | undefined): string | null {
    if (raw === null || raw === undefined) return null;
    if (raw.trim() === '') return null;
    return cleanText(raw, TITLE_MAX);
  }

  function cleanEffort(raw: number | null | undefined): number | null {
    if (raw === null || raw === undefined) return null;
    if (!validEffort(raw)) throw new ListsError('VALIDATION_FAILED');
    return raw;
  }

  return {
    state: buildState,
    summary: () => buildSummary(),

    addItem(input) {
      return mutate<{ state: ListsState; created: boolean }>((now) => {
        if (findItem(input.id))
          return { changed: false, value: (state) => ({ state, created: false }) };
        const title = cleanText(input.title, TITLE_MAX);
        const key = keyOf(title);
        if (input.list === 'shopping') {
          if (
            input.categoryId !== undefined ||
            input.priority !== undefined ||
            (input.effortHours !== undefined && input.effortHours !== null) ||
            (input.prerequisite !== undefined && input.prerequisite !== null)
          ) {
            throw new ListsError('VALIDATION_FAILED');
          }
          const open = db
            .prepare(
              "SELECT 1 FROM list_items WHERE list = 'shopping' AND deleted_at IS NULL AND checked_at IS NULL AND title_key = ?",
            )
            .get(key);
          if (open) return { changed: false, value: (state) => ({ state, created: false }) };
          assertRoom('shopping');
          db.prepare(
            `INSERT INTO list_items (id, list, title, title_key, created_at, updated_at)
             VALUES (?, 'shopping', ?, ?, ?, ?)`,
          ).run(input.id, title, key, now, now);
          db.prepare(
            `INSERT INTO shopping_history (title_key, title, uses, last_used) VALUES (?, ?, 1, ?)
             ON CONFLICT(title_key) DO UPDATE SET title = excluded.title, uses = uses + 1, last_used = excluded.last_used`,
          ).run(key, title, now);
        } else {
          if (input.categoryId === undefined || !activeCategory(input.categoryId)) {
            throw new ListsError('VALIDATION_FAILED');
          }
          const effort = cleanEffort(input.effortHours);
          const prerequisite = cleanPrerequisite(input.prerequisite);
          assertRoom('todo');
          db.prepare(
            `INSERT INTO list_items
               (id, list, title, title_key, category_id, priority, effort_hours, prerequisite, created_at, updated_at)
             VALUES (?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            input.id,
            title,
            key,
            input.categoryId,
            input.priority ?? 'medium',
            effort,
            prerequisite,
            now,
            now,
          );
        }
        return { changed: true, value: (state) => ({ state, created: true }) };
      });
    },

    patchItem(id, input) {
      return mutate((now) => {
        const row = findItem(id);
        if (!row || row.deleted_at !== null) throw new ListsError('NOT_FOUND');
        const keys = Object.keys(input).filter(
          (key) => (input as Record<string, unknown>)[key] !== undefined,
        );
        if (keys.length === 0) throw new ListsError('VALIDATION_FAILED');
        const sets: string[] = [];
        const values: unknown[] = [];
        if (input.title !== undefined) {
          const title = cleanText(input.title, TITLE_MAX);
          sets.push('title = ?', 'title_key = ?');
          values.push(title, keyOf(title));
        }
        if (input.checked !== undefined) {
          sets.push('checked_at = ?');
          values.push(input.checked ? now : null);
        }
        const todoOnly = ['categoryId', 'priority', 'effortHours', 'prerequisite'].some((key) =>
          keys.includes(key),
        );
        if (todoOnly && row.list !== 'todo') throw new ListsError('VALIDATION_FAILED');
        if (input.categoryId !== undefined) {
          if (!activeCategory(input.categoryId)) throw new ListsError('VALIDATION_FAILED');
          sets.push('category_id = ?');
          values.push(input.categoryId);
        }
        if (input.priority !== undefined) {
          sets.push('priority = ?');
          values.push(input.priority);
        }
        if (input.effortHours !== undefined) {
          sets.push('effort_hours = ?');
          values.push(cleanEffort(input.effortHours));
        }
        if (input.prerequisite !== undefined) {
          sets.push('prerequisite = ?');
          values.push(cleanPrerequisite(input.prerequisite));
        }
        sets.push('updated_at = ?');
        values.push(now, id);
        db.prepare(`UPDATE list_items SET ${sets.join(', ')} WHERE id = ?`).run(...values);
        return { changed: true, value: (state) => state };
      });
    },

    deleteItem(id) {
      return mutate((now) => {
        const row = findItem(id);
        if (!row) throw new ListsError('NOT_FOUND');
        if (row.deleted_at !== null) return { changed: false, value: (state) => state };
        db.prepare('UPDATE list_items SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
          now,
          now,
          id,
        );
        return { changed: true, value: (state) => state };
      });
    },

    restoreItem(id) {
      return mutate((now) => {
        const row = findItem(id);
        if (!row) throw new ListsError('NOT_FOUND');
        if (row.deleted_at === null) return { changed: false, value: (state) => state };
        if (n(counts.open, row.list) >= MAX_OPEN_PER_LIST)
          throw new ListsError('LIST_LIMIT_REACHED');
        db.prepare('UPDATE list_items SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(
          now,
          id,
        );
        return { changed: true, value: (state) => state };
      });
    },

    addCategory(input) {
      return mutate<{ state: ListsState; created: boolean }>((now) => {
        const existing = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(input.id);
        if (existing) return { changed: false, value: (state) => ({ state, created: false }) };
        const name = cleanText(input.name, NAME_MAX);
        const key = keyOf(name);
        if (
          db.prepare('SELECT 1 FROM categories WHERE name_key = ? AND deleted_at IS NULL').get(key)
        ) {
          throw new ListsError('CATEGORY_NAME_TAKEN');
        }
        if (n(counts.categories) >= MAX_CATEGORIES) throw new ListsError('LIST_LIMIT_REACHED');
        const position = (
          db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM categories').get() as {
            p: number;
          }
        ).p;
        db.prepare(
          'INSERT INTO categories (id, name, name_key, position, builtin, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        ).run(input.id, name, key, position, now);
        return { changed: true, value: (state) => ({ state, created: true }) };
      });
    },

    renameCategory(id, rawName) {
      return mutate(() => {
        if (id === FALLBACK_CATEGORY) throw new ListsError('CATEGORY_PROTECTED');
        const row = db.prepare('SELECT deleted_at FROM categories WHERE id = ?').get(id) as
          { deleted_at: number | null } | undefined;
        if (!row || row.deleted_at !== null) throw new ListsError('NOT_FOUND');
        const name = cleanText(rawName, NAME_MAX);
        const key = keyOf(name);
        const taken = db
          .prepare('SELECT 1 FROM categories WHERE name_key = ? AND deleted_at IS NULL AND id <> ?')
          .get(key, id);
        if (taken) throw new ListsError('CATEGORY_NAME_TAKEN');
        db.prepare('UPDATE categories SET name = ?, name_key = ? WHERE id = ?').run(name, key, id);
        return { changed: true, value: (state) => state };
      });
    },

    deleteCategory(id) {
      return mutate((now) => {
        if (id === FALLBACK_CATEGORY) throw new ListsError('CATEGORY_PROTECTED');
        const row = db.prepare('SELECT deleted_at FROM categories WHERE id = ?').get(id) as
          { deleted_at: number | null } | undefined;
        if (!row) throw new ListsError('NOT_FOUND');
        if (row.deleted_at !== null) return { changed: false, value: (state) => state };
        db.prepare('UPDATE categories SET deleted_at = ? WHERE id = ?').run(now, id);
        return { changed: true, value: (state) => state };
      });
    },

    restoreCategory(id) {
      return mutate(() => {
        const row = db
          .prepare('SELECT name_key, deleted_at FROM categories WHERE id = ?')
          .get(id) as { name_key: string; deleted_at: number | null } | undefined;
        if (!row) throw new ListsError('NOT_FOUND');
        if (row.deleted_at === null) return { changed: false, value: (state) => state };
        if (
          db
            .prepare('SELECT 1 FROM categories WHERE name_key = ? AND deleted_at IS NULL')
            .get(row.name_key)
        ) {
          throw new ListsError('CATEGORY_NAME_TAKEN');
        }
        db.prepare('UPDATE categories SET deleted_at = NULL WHERE id = ?').run(id);
        return { changed: true, value: (state) => state };
      });
    },

    purge(now) {
      db.transaction(() => {
        if (purgeInternal(now)) publish();
      })();
    },
  };
}
