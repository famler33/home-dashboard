export type Priority = 'high' | 'medium' | 'low';

export interface ShoppingItem {
  id: string;
  title: string;
  checkedAt: string | null;
  createdAt: string;
}

export interface TodoItem {
  id: string;
  title: string;
  categoryId: string;
  priority: Priority;
  effortHours: number | null;
  prerequisite: string | null;
  checkedAt: string | null;
  createdAt: string;
}

export interface ListsCategory {
  id: string;
  name: string;
  position: number;
  builtin: boolean;
  openTodoCount: number;
}

export interface ListsCounts {
  shoppingOpen: number;
  todoOpen: number;
  todoHigh: number;
}

/** Full editor state, served by `GET /api/v1/lists` and returned by every change. */
export interface ListsState {
  epoch: string;
  rev: number;
  categories: ListsCategory[];
  shopping: ShoppingItem[];
  todos: TodoItem[];
  suggestions: string[];
}

/** Compact snapshot entry for the tile. */
export interface ListsSummary {
  epoch: string;
  rev: number;
  truncated: boolean;
  categories: { id: string; name: string }[];
  shopping: ShoppingItem[];
  todos: TodoItem[];
  counts: ListsCounts;
}

const priorities: readonly unknown[] = ['high', 'medium', 'low'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): boolean => value === null || isString(value);
const isNullableNumber = (value: unknown): boolean => value === null || typeof value === 'number';

function isShoppingItem(value: unknown): value is ShoppingItem {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isString(value['title']) &&
    isNullableString(value['checkedAt']) &&
    isString(value['createdAt'])
  );
}

function isTodoItem(value: unknown): value is TodoItem {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isString(value['title']) &&
    isString(value['categoryId']) &&
    priorities.includes(value['priority']) &&
    isNullableNumber(value['effortHours']) &&
    isNullableString(value['prerequisite']) &&
    isNullableString(value['checkedAt']) &&
    isString(value['createdAt'])
  );
}

function isCategory(value: unknown): value is ListsCategory {
  return (
    isRecord(value) &&
    isString(value['id']) &&
    isString(value['name']) &&
    typeof value['position'] === 'number' &&
    typeof value['builtin'] === 'boolean' &&
    typeof value['openTodoCount'] === 'number'
  );
}

const every = (value: unknown, check: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(check);

export function isListsState(value: unknown): value is ListsState {
  return (
    isRecord(value) &&
    isString(value['epoch']) &&
    typeof value['rev'] === 'number' &&
    every(value['categories'], isCategory) &&
    every(value['shopping'], isShoppingItem) &&
    every(value['todos'], isTodoItem) &&
    every(value['suggestions'], isString)
  );
}

export function isListsSummary(value: unknown): value is ListsSummary {
  if (!isRecord(value)) return false;
  const counts = value['counts'];
  return (
    isString(value['epoch']) &&
    typeof value['rev'] === 'number' &&
    typeof value['truncated'] === 'boolean' &&
    every(
      value['categories'],
      (item) => isRecord(item) && isString(item['id']) && isString(item['name']),
    ) &&
    every(value['shopping'], isShoppingItem) &&
    every(value['todos'], isTodoItem) &&
    isRecord(counts) &&
    typeof counts['shoppingOpen'] === 'number' &&
    typeof counts['todoOpen'] === 'number' &&
    typeof counts['todoHigh'] === 'number'
  );
}
