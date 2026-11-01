import { useEffect, useState } from 'react';

interface Options {
  frameCount: number;
  /** Index of the current (newest observed) frame; shown while the loop does not run. */
  startIndex: number;
  active: boolean;
  reducedMotion: boolean;
  stepMs?: number;
  holdMs?: number;
}

/** Index of the frame to show: steps through all frames, holds the last one, then restarts. */
export function useRadarLoop({
  frameCount,
  startIndex,
  active,
  reducedMotion,
  stepMs = 450,
  holdMs = 2_000,
}: Options): number {
  const running = active && !reducedMotion && frameCount > 1;
  const key = `${startIndex}:${frameCount}:${running}`;
  const [state, setState] = useState({ key, index: startIndex });

  useEffect(() => {
    if (!running) return undefined;
    let current = startIndex;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (): void => {
      const last = current >= frameCount - 1;
      timer = setTimeout(
        () => {
          current = last ? 0 : current + 1;
          setState({ key, index: current });
          schedule();
        },
        last ? holdMs : stepMs,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [running, startIndex, frameCount, stepMs, holdMs, key]);

  const fallback = Math.min(startIndex, Math.max(0, frameCount - 1));
  return running && state.key === key ? state.index : fallback;
}
