export type Priority = 'high' | 'medium' | 'low';
export type ListName = 'shopping' | 'todo';

export interface ListsCategory {
  id: string;
  name: string;
  position: number;
  builtin: boolean;
  openTodoCount: number;
}

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

export interface ListsState {
  epoch: string;
  rev: number;
  categories: ListsCategory[];
  shopping: ShoppingItem[];
  todos: TodoItem[];
  suggestions: string[];
}

export interface ListsSummary {
  epoch: string;
  rev: number;
  truncated: boolean;
  categories: { id: string; name: string }[];
  shopping: ShoppingItem[];
  todos: TodoItem[];
  counts: { shoppingOpen: number; todoOpen: number; todoHigh: number };
}

export interface AddItemInput {
  id: string;
  list: ListName;
  title: string;
  categoryId?: string | undefined;
  priority?: Priority | undefined;
  effortHours?: number | null | undefined;
  prerequisite?: string | null | undefined;
}

export interface PatchItemInput {
  title?: string | undefined;
  checked?: boolean | undefined;
  categoryId?: string | undefined;
  priority?: Priority | undefined;
  effortHours?: number | null | undefined;
  prerequisite?: string | null | undefined;
}
