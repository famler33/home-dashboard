import { useCallback, useEffect, useRef, useState } from 'react';

/** Remembers ids for a short time (the "Rückgängig" window after checking). */
export function useUndoWindow(ms: number) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const stop = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const start = useCallback(
    (id: string) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        id,
        setTimeout(() => stop(id), ms),
      );
      setIds((current) => new Set(current).add(id));
    },
    [ms, stop],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  return { ids, start, stop };
}
