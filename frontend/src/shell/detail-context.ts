import { createContext, useContext } from 'react';

export interface DetailContextValue {
  /** Opens the detail view of a tile; the trigger gets the focus back when the view closes. */
  open(tileId: string, trigger?: HTMLElement | null): void;
}

export const DetailContext = createContext<DetailContextValue>({ open: () => undefined });

export function useDetail(): DetailContextValue {
  return useContext(DetailContext);
}

export interface DetailBusyValue {
  /** A detail component reports an open sheet or an unsaved draft: the view must not close by itself. */
  setBusy(on: boolean): void;
}

export const DetailBusyContext = createContext<DetailBusyValue>({ setBusy: () => undefined });

export function useDetailBusy(): DetailBusyValue {
  return useContext(DetailBusyContext);
}
