import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSnapshotStore } from '../cache/snapshot-store.js';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { createListsService, ListsError, type ListsService } from './lists-service.js';

const t0 = Date.parse('2026-10-28T10:00:00Z'); // Wednesday 11:00 Berlin
let db: Database.Database;
let service: ListsService;
let now = t0;
const store = () => createSnapshotStore(db);

function setup(timezone = 'Europe/Berlin') {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, migrationsDir);
  now = t0;
  service = createListsService({ db, store: store(), now: () => now, timezone });
}

const id = () => randomUUID();
const shop = (title: string) => service.addItem({ id: id(), list: 'shopping', title }).state;
const todo = (title: string, extra: Record<string, unknown> = {}) =>
  service.addItem({ id: id(), list: 'todo', title, categoryId: 'sonstiges', ...extra }).state;
const fail = (action: () => unknown, code: string) => {
  try {
    action();
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(ListsError);
    expect((error as ListsError).code).toBe(code);
  }
};

beforeEach(() => setup());

// Covers: FR-1, FR-3, FR-4, FR-5, FR-6, FR-8, FR-9, NFR-3, NFR-7, AC-1, AC-2, AC-6
describe('ListsService state', () => {
  it('has exactly a shopping list and a to-do list, starts empty and seeds the categories', () => {
    const state = service.state();
    expect(state.shopping).toEqual([]);
    expect(state.todos).toEqual([]);
    expect(state.suggestions).toEqual([]);
    expect(state.categories.map((category) => category.name)).toEqual([
      'Wohnzimmer',
      'Büro',
      'Balkon',
      'Gang',
      'Großes Bad',
      'Kleines Bad',
      'Küche',
      'Schlafzimmer',
      'Kinderzimmer',
      'Sonstiges',
    ]);
    expect(state.rev).toBe(0);
    expect(typeof state.epoch).toBe('string');
  });

  it('accepts category, priority, effort and prerequisite only on to-dos', () => {
    fail(
      () => service.addItem({ id: id(), list: 'shopping', title: 'Milch', priority: 'high' }),
      'VALIDATION_FAILED',
    );
    fail(
      () => service.addItem({ id: id(), list: 'shopping', title: 'Milch', categoryId: 'balkon' }),
      'VALIDATION_FAILED',
    );
    const state = todo('Regal', {
      categoryId: 'balkon',
      priority: 'high',
      effortHours: 1.5,
      prerequisite: 'Schrauben',
    });
    expect(state.todos[0]).toMatchObject({
      title: 'Regal',
      categoryId: 'balkon',
      priority: 'high',
      effortHours: 1.5,
      prerequisite: 'Schrauben',
    });
  });

  it('rejects empty or too long titles and unknown categories', () => {
    fail(() => service.addItem({ id: id(), list: 'shopping', title: '  ' }), 'VALIDATION_FAILED');
    fail(
      () => service.addItem({ id: id(), list: 'shopping', title: 'x'.repeat(81) }),
      'VALIDATION_FAILED',
    );
    fail(
      () => service.addItem({ id: id(), list: 'todo', title: 'A', categoryId: 'unknown' }),
      'VALIDATION_FAILED',
    );
    fail(() => service.addItem({ id: id(), list: 'todo', title: 'A' }), 'VALIDATION_FAILED');
  });

  it('defaults a to-do to medium priority and validates the effort in half hours up to 99', () => {
    expect(todo('A').todos[0]?.priority).toBe('medium');
    for (const bad of [0.25, 100, -1, 99.5]) {
      fail(() => todo('B', { effortHours: bad }), 'VALIDATION_FAILED');
    }
    expect(todo('C', { effortHours: 99 }).todos.some((item) => item.effortHours === 99)).toBe(true);
    expect(todo('D', { effortHours: 0 }).todos.some((item) => item.effortHours === 0)).toBe(true);
  });
});

describe('ListsService shopping list', () => {
  it('returns open entries newest first', () => {
    shop('Milch');
    now += 1000;
    shop('Brot');
    expect(service.state().shopping.map((item) => item.title)).toEqual(['Brot', 'Milch']);
  });

  it('is idempotent for the same id and does not add a title that is already open', () => {
    const itemId = id();
    service.addItem({ id: itemId, list: 'shopping', title: 'Milch' });
    const again = service.addItem({ id: itemId, list: 'shopping', title: 'Milch' });
    expect(again.created).toBe(false);
    const dup = service.addItem({ id: id(), list: 'shopping', title: ' MILCH ' });
    expect(dup.created).toBe(false);
    expect(service.state().shopping).toHaveLength(1);
    const umlaut = service.addItem({ id: id(), list: 'shopping', title: 'Äpfel' });
    expect(umlaut.created).toBe(true);
    expect(service.addItem({ id: id(), list: 'shopping', title: 'äpfel' }).created).toBe(false);
  });

  it('sets and clears checked_at and moves checked entries below the open ones', () => {
    const first = shop('Milch').shopping[0]!;
    now += 1000;
    shop('Brot');
    const checked = service.patchItem(first.id, { checked: true });
    expect(checked.shopping.map((item) => [item.title, item.checkedAt !== null])).toEqual([
      ['Brot', false],
      ['Milch', true],
    ]);
    expect(
      service
        .patchItem(first.id, { checked: false })
        .shopping.every((item) => item.checkedAt === null),
    ).toBe(true);
  });

  it('removes entries on the next local day and keeps those from today', () => {
    const milk = shop('Milch').shopping[0]!;
    service.patchItem(milk.id, { checked: true });
    now = Date.parse('2026-10-28T21:59:59Z'); // 22:59:59 local, same day
    service.purge(now);
    expect(service.state().shopping).toHaveLength(1);
    now = Date.parse('2026-10-28T23:00:00Z'); // 00:00 local, next day
    service.purge(now);
    expect(service.state().shopping).toHaveLength(0);
  });

  it('uses the configured time zone and the clock change day for the next day rule', () => {
    setup('Europe/Berlin');
    now = Date.parse('2026-10-25T22:30:00Z'); // 23:30 CET on the clock change day
    const item = shop('Milch').shopping[0]!;
    service.patchItem(item.id, { checked: true });
    now = Date.parse('2026-10-25T23:30:00Z'); // 00:30 next day
    service.purge(now);
    expect(service.state().shopping).toHaveLength(0);
  });

  it('keeps earlier titles in the history, most recent first, and offers only entries that are not open', () => {
    const milk = shop('Milch').shopping[0]!;
    now += 1000;
    shop('Brot');
    service.deleteItem(milk.id);
    const state = service.state();
    expect(state.suggestions).toEqual(['Milch']);
    now += 1000;
    shop('Milch');
    expect(service.state().suggestions).toEqual([]);
    for (let index = 0; index < 120; index += 1) {
      now += 1000;
      const added = shop(`Artikel ${index}`).shopping[0]!;
      service.deleteItem(added.id);
    }
    expect(service.state().suggestions).toHaveLength(100);
  });
});

describe('ListsService to-dos', () => {
  it('orders to-dos by priority then oldest first and checked ones last', () => {
    todo('Niedrig alt', { priority: 'low' });
    now += 1000;
    todo('Hoch neu', { priority: 'high' });
    now += 1000;
    todo('Hoch neuer', { priority: 'high' });
    now += 1000;
    const mid = todo('Mittel').todos.find((item) => item.title === 'Mittel')!;
    service.patchItem(mid.id, { checked: true });
    expect(service.state().todos.map((item) => item.title)).toEqual([
      'Hoch neu',
      'Hoch neuer',
      'Niedrig alt',
      'Mittel',
    ]);
  });

  it('changes priority, category, effort and prerequisite, clears with null and keeps when omitted', () => {
    const item = todo('Regal', { effortHours: 2, prerequisite: 'Material' }).todos[0]!;
    const changed = service.patchItem(item.id, { priority: 'low', categoryId: 'balkon' }).todos[0]!;
    expect(changed).toMatchObject({
      priority: 'low',
      categoryId: 'balkon',
      effortHours: 2,
      prerequisite: 'Material',
    });
    const cleared = service.patchItem(item.id, { effortHours: null, prerequisite: null }).todos[0]!;
    expect(cleared.effortHours).toBeNull();
    expect(cleared.prerequisite).toBeNull();
    fail(() => service.patchItem(item.id, {}), 'VALIDATION_FAILED');
    fail(() => service.patchItem(item.id, { categoryId: 'nope' }), 'VALIDATION_FAILED');
  });

  it('refuses to-do fields on shopping entries when patching', () => {
    const milk = shop('Milch').shopping[0]!;
    fail(() => service.patchItem(milk.id, { priority: 'high' }), 'VALIDATION_FAILED');
  });

  it('applies the same checked rule to to-dos', () => {
    const item = todo('Regal').todos[0]!;
    service.patchItem(item.id, { checked: true });
    now = Date.parse('2026-10-29T10:00:00Z');
    service.purge(now);
    expect(service.state().todos).toHaveLength(0);
  });

  it('applies concurrent patches per field, the last one wins', () => {
    const item = todo('Regal').todos[0]!;
    service.patchItem(item.id, { priority: 'high', prerequisite: 'A' });
    service.patchItem(item.id, { prerequisite: 'B' });
    expect(service.state().todos[0]).toMatchObject({ priority: 'high', prerequisite: 'B' });
  });
});

describe('ListsService removing and undo', () => {
  it('tombstones an entry, is idempotent and answers NOT_FOUND for unknown ids', () => {
    const milk = shop('Milch').shopping[0]!;
    expect(service.deleteItem(milk.id).shopping).toHaveLength(0);
    expect(service.deleteItem(milk.id).shopping).toHaveLength(0);
    fail(() => service.deleteItem(id()), 'NOT_FOUND');
    fail(() => service.patchItem(milk.id, { title: 'x' }), 'NOT_FOUND');
  });

  it('restores within the tombstone time and answers NOT_FOUND after the purge', () => {
    const milk = shop('Milch').shopping[0]!;
    service.deleteItem(milk.id);
    expect(service.restoreItem(milk.id).shopping).toHaveLength(1);
    service.deleteItem(milk.id);
    now += 61 * 60_000;
    service.purge(now);
    fail(() => service.restoreItem(milk.id), 'NOT_FOUND');
  });

  it('counts tombstones against the row cap and purges old ones on write', () => {
    for (let index = 0; index < 600; index += 1) {
      const added = shop(`Artikel ${index}`).shopping[0]!;
      service.deleteItem(added.id);
      if (index === 499) break;
    }
    // 500 tombstones, none open: adding is still possible because the cap counts open rows and 600 rows
    for (let index = 0; index < 100; index += 1) shop(`Neu ${index}`);
    fail(() => shop('Zu viel'), 'LIST_LIMIT_REACHED');
    now += 61 * 60_000;
    expect(shop('Nach der Bereinigung').shopping.length).toBeGreaterThan(0);
  });

  it('rejects the 501st open entry of a list', () => {
    for (let index = 0; index < 500; index += 1) shop(`Artikel ${index}`);
    fail(() => shop('Zu viel'), 'LIST_LIMIT_REACHED');
  });
});

describe('ListsService categories', () => {
  it('adds, renames and removes categories and keeps names unique ignoring case and umlauts', () => {
    const created = service.addCategory({ id: id(), name: 'Garten' });
    expect(created.created).toBe(true);
    const gardenId = created.state.categories.find((category) => category.name === 'Garten')!.id;
    fail(() => service.addCategory({ id: id(), name: 'GARTEN' }), 'CATEGORY_NAME_TAKEN');
    fail(() => service.addCategory({ id: id(), name: 'küche' }), 'CATEGORY_NAME_TAKEN');
    fail(() => service.addCategory({ id: id(), name: 'x'.repeat(21) }), 'VALIDATION_FAILED');
    fail(() => service.addCategory({ id: id(), name: '  ' }), 'VALIDATION_FAILED');
    expect(
      service
        .renameCategory(gardenId, 'Garage')
        .categories.some((category) => category.name === 'Garage'),
    ).toBe(true);
    fail(() => service.renameCategory(gardenId, 'Büro'), 'CATEGORY_NAME_TAKEN');
    service.deleteCategory(gardenId);
    expect(service.state().categories.some((category) => category.id === gardenId)).toBe(false);
  });

  it('keeps categories idempotent for the same id', () => {
    const categoryId = id();
    service.addCategory({ id: categoryId, name: 'Garten' });
    expect(service.addCategory({ id: categoryId, name: 'Garten' }).created).toBe(false);
  });

  it('refuses to rename or remove Sonstiges and answers NOT_FOUND for unknown categories', () => {
    fail(() => service.renameCategory('sonstiges', 'Anderes'), 'CATEGORY_PROTECTED');
    fail(() => service.deleteCategory('sonstiges'), 'CATEGORY_PROTECTED');
    fail(() => service.renameCategory(id(), 'Neu'), 'NOT_FOUND');
    fail(() => service.deleteCategory(id()), 'NOT_FOUND');
  });

  it('shows the new name on every to-do and counts open to-dos per category', () => {
    todo('A', { categoryId: 'balkon' });
    todo('B', { categoryId: 'balkon' });
    const done = todo('C', { categoryId: 'balkon' }).todos.find((item) => item.title === 'C')!;
    service.patchItem(done.id, { checked: true });
    const state = service.renameCategory('balkon', 'Terrasse');
    expect(state.categories.find((category) => category.id === 'balkon')).toMatchObject({
      name: 'Terrasse',
      openTodoCount: 2,
    });
  });

  it('reads the to-dos of a removed category as Sonstiges and restores them with the category', () => {
    todo('Regal', { categoryId: 'balkon' });
    const removed = service.deleteCategory('balkon');
    expect(removed.todos[0]?.categoryId).toBe('sonstiges');
    expect(removed.categories.find((category) => category.id === 'sonstiges')?.openTodoCount).toBe(
      1,
    );
    const restored = service.restoreCategory('balkon');
    expect(restored.todos[0]?.categoryId).toBe('balkon');
  });

  it('moves the to-dos to Sonstiges for good when the tombstone expires', () => {
    todo('Regal', { categoryId: 'balkon' });
    service.deleteCategory('balkon');
    now += 61 * 60_000;
    service.purge(now);
    fail(() => service.restoreCategory('balkon'), 'NOT_FOUND');
    expect(service.state().todos[0]?.categoryId).toBe('sonstiges');
  });

  it('refuses to restore a category whose name is now used', () => {
    service.deleteCategory('balkon');
    service.addCategory({ id: id(), name: 'Balkon' });
    fail(() => service.restoreCategory('balkon'), 'CATEGORY_NAME_TAKEN');
  });

  it('rejects the 101st category', () => {
    for (let index = 0; index < 90; index += 1)
      service.addCategory({ id: id(), name: `Kat ${index}` });
    fail(() => service.addCategory({ id: id(), name: 'Zu viel' }), 'LIST_LIMIT_REACHED');
  });
});

describe('ListsService snapshot and consistency', () => {
  it('records the summary in the same transaction and bumps rev', () => {
    shop('Milch');
    const row = store().get('lists');
    const summary = row?.payload as {
      rev: number;
      shopping: unknown[];
      counts: { shoppingOpen: number };
    };
    expect(summary.rev).toBe(1);
    expect(summary.shopping).toHaveLength(1);
    expect(summary.counts.shoppingOpen).toBe(1);
    expect(service.state().rev).toBe(1);
  });

  it('rolls back everything when a mutation fails', () => {
    shop('Milch');
    const before = service.state().rev;
    fail(
      () => service.addItem({ id: id(), list: 'todo', title: 'A', categoryId: 'nope' }),
      'VALIDATION_FAILED',
    );
    expect(service.state().rev).toBe(before);
    expect((store().get('lists')?.payload as { rev: number }).rev).toBe(before);
  });

  it('limits the summary to 30 shopping and 40 to-do rows and reports counts and truncation', () => {
    for (let index = 0; index < 35; index += 1) shop(`Artikel ${index}`);
    for (let index = 0; index < 45; index += 1)
      todo(`Aufgabe ${index}`, { priority: index < 9 ? 'high' : 'medium' });
    const summary = service.summary();
    expect(summary.shopping).toHaveLength(30);
    expect(summary.todos).toHaveLength(40);
    expect(summary.counts).toEqual({ shoppingOpen: 35, todoOpen: 45, todoHigh: 9 });
    expect(summary.truncated).toBe(true);
  });

  it('serves the same data after a restart on the same database with a new epoch', () => {
    shop('Milch');
    const first = service.state();
    const restarted = createListsService({
      db,
      store: store(),
      now: () => now,
      timezone: 'Europe/Berlin',
    });
    const second = restarted.state();
    expect(second.shopping.map((item) => item.title)).toEqual(['Milch']);
    expect(second.rev).toBe(first.rev);
    expect(second.epoch).not.toBe(first.epoch);
  });

  it('bumps rev when a purge changes something and publishes the summary', () => {
    const milk = shop('Milch').shopping[0]!;
    service.patchItem(milk.id, { checked: true });
    const rev = service.state().rev;
    now = Date.parse('2026-10-29T12:00:00Z');
    service.purge(now);
    expect(service.state().rev).toBe(rev + 1);
    expect((store().get('lists')?.payload as { rev: number }).rev).toBe(rev + 1);
    service.purge(now);
    expect(service.state().rev).toBe(rev + 1);
  });
});
