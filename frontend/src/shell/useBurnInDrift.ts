import { useEffect, useState } from 'react';
import type { Theme } from './useDayNight';

const STEP_MS = 5 * 60_000;

/** Eight positions within +-8 px; neighbours always differ so no pixel stays static for long. */
export const driftOffsets: readonly (readonly [number, number])[] = [
  [0, 0],
  [6, -4],
  [-5, 7],
  [8, 3],
  [-7, -6],
  [3, 8],
  [-8, 2],
  [4, -8],
];

export interface Drift {
  x: number;
  y: number;
  /** False: apply the offset as an instant step without a transition. */
  animate: boolean;
}

export function useBurnInDrift(args: {
  enabled: boolean;
  theme: Theme;
  reducedMotion: boolean;
}): Drift {
  const { enabled, theme, reducedMotion } = args;
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(
      () => setStep((current) => (current + 1) % driftOffsets.length),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, [enabled]);

  if (!enabled) return { x: 0, y: 0, animate: false };
  const [x, y] = driftOffsets[step] ?? [0, 0];
  const scale = theme === 'night' ? 1 : 0.5;
  return { x: Math.round(x * scale), y: Math.round(y * scale), animate: !reducedMotion };
}
