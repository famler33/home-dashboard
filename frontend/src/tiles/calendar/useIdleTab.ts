import { useCallback, useEffect, useState } from 'react';
import type { CalendarTab } from './types';

interface Options {
  /** On the wall the tile returns to "Alle" after `idleMs` without input. */
  idleReset: boolean;
  idleMs: number;
}

export interface IdleTab {
  tab: CalendarTab;
  select(tab: CalendarTab): void;
  /** Call on any input inside the tile to restart the countdown. */
  touch(): void;
}

export function useIdleTab({ idleReset, idleMs }: Options): IdleTab {
  const [state, setState] = useState<{ tab: CalendarTab; input: number }>({
    tab: 'all',
    input: 0,
  });

  useEffect(() => {
    if (!idleReset || state.tab === 'all') return undefined;
    const timer = setTimeout(() => setState((current) => ({ ...current, tab: 'all' })), idleMs);
    return () => clearTimeout(timer);
  }, [idleReset, idleMs, state.tab, state.input]);

  const select = useCallback(
    (tab: CalendarTab) => setState((current) => ({ tab, input: current.input + 1 })),
    [],
  );
  const touch = useCallback(
    () => setState((current) => ({ ...current, input: current.input + 1 })),
    [],
  );
  return { tab: state.tab, select, touch };
}
