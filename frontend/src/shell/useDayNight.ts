import { useEffect, useState } from 'react';
import type { SnapshotSettings } from '../api/types';
import { localParts, toMinutes } from '../time';

export type Theme = 'day' | 'night';

const RECHECK_MS = 30_000;

/** True between `nightFrom` (inclusive) and `nightTo` (exclusive) on the wall clock of `timeZone`. */
export function isNight(
  nowMs: number,
  timeZone: string,
  nightFrom: string,
  nightTo: string,
): boolean {
  const from = toMinutes(nightFrom);
  const to = toMinutes(nightTo);
  if (from === to) return false;
  const { minutes } = localParts(nowMs, timeZone);
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

function themeFor(settings: SnapshotSettings | undefined): Theme {
  if (!settings) return 'day';
  const { timezone, display } = settings;
  return isNight(Date.now(), timezone, display.nightFrom, display.nightTo) ? 'night' : 'day';
}

export function useDayNight(settings: SnapshotSettings | undefined): Theme {
  const [theme, setTheme] = useState<Theme>(() => themeFor(settings));

  useEffect(() => {
    const update = (): void => setTheme(themeFor(settings));
    const timer = setInterval(update, RECHECK_MS);
    document.documentElement.dataset['theme'] = themeFor(settings);
    return () => clearInterval(timer);
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);

  return theme;
}
