import { useCallback, useEffect, useState } from 'react';

interface Options {
  viewCount: number;
  dwellMs: number;
  resumeMs: number;
  /** Automatic rotation; manual switching works either way. */
  autoplay: boolean;
}

export interface ViewRotation {
  index: number;
  paused: boolean;
  goTo(index: number): void;
  next(): void;
  prev(): void;
}

const wrap = (value: number, count: number): number => ((value % count) + count) % count;

/** Rotates through the views; any manual input pauses it until `resumeMs` pass without input. */
export function useViewRotation({ viewCount, dwellMs, resumeMs, autoplay }: Options): ViewRotation {
  const [state, setState] = useState({ index: 0, paused: false, input: 0 });

  useEffect(() => {
    if (!autoplay) return undefined;
    const timer = setTimeout(
      () =>
        setState((current) =>
          current.paused
            ? { ...current, paused: false }
            : { ...current, index: wrap(current.index + 1, viewCount) },
        ),
      state.paused ? resumeMs : dwellMs,
    );
    return () => clearTimeout(timer);
  }, [autoplay, state.paused, state.index, state.input, viewCount, dwellMs, resumeMs]);

  const goTo = useCallback(
    (index: number) =>
      setState((current) => ({
        index: wrap(index, viewCount),
        paused: true,
        input: current.input + 1,
      })),
    [viewCount],
  );
  const next = useCallback(
    () =>
      setState((current) => ({
        index: wrap(current.index + 1, viewCount),
        paused: true,
        input: current.input + 1,
      })),
    [viewCount],
  );
  const prev = useCallback(
    () =>
      setState((current) => ({
        index: wrap(current.index - 1, viewCount),
        paused: true,
        input: current.input + 1,
      })),
    [viewCount],
  );

  return { index: state.index, paused: state.paused, goTo, next, prev };
}
