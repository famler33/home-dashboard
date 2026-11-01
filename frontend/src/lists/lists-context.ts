import { createContext, useContext, useEffect } from 'react';
import type { ItemPatch } from '../api/lists';
import type { Priority } from '../api/lists-types';
import { initialModel, selectView, type ListsView } from './listsReducer';

export interface NewTodo {
  title: string;
  categoryId: string;
  priority?: Priority;
  effortHours?: number | null;
  prerequisite?: string | null;
}

export interface ListsController {
  view: ListsView;
  addShopping(title: string): string;
  addTodo(input: NewTodo): string;
  patch(id: string, patch: ItemPatch): void;
  remove(id: string): void;
  restore(id: string): void;
  addCategory(name: string): string;
  renameCategory(id: string, name: string): void;
  removeCategory(id: string): void;
  restoreCategory(id: string): void;
  retry(): void;
  dismissNotice(): void;
  /** While held, poll and snapshot states wait until the user is done (open sheet, finger on the list). */
  setHold(on: boolean): void;
  /** An editor calls this while it is mounted; the full state is polled only then. */
  registerEditor(): () => void;
}

const idle: ListsController = {
  view: selectView(initialModel),
  addShopping: () => '',
  addTodo: () => '',
  patch: () => undefined,
  remove: () => undefined,
  restore: () => undefined,
  addCategory: () => '',
  renameCategory: () => undefined,
  removeCategory: () => undefined,
  restoreCategory: () => undefined,
  retry: () => undefined,
  dismissNotice: () => undefined,
  setHold: () => undefined,
  registerEditor: () => () => undefined,
};

export const ListsContext = createContext<ListsController>(idle);

export function useLists(): ListsController {
  return useContext(ListsContext);
}

/** Marks an editor as open: starts the 10 second poll of the full state while it is mounted. */
export function useListsEditor(): void {
  const { registerEditor } = useLists();
  useEffect(() => registerEditor(), [registerEditor]);
}
