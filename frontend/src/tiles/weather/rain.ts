import type { SourceSnapshot } from '../../api/types';

export interface RainStep {
  /** Start of the step in epoch ms. */
  time: number;
  mmPerHour: number;
}

export type RainStatement =
  | { kind: 'none' }
  | { kind: 'raining'; endsAt: number | null; horizonEnd: number }
  | { kind: 'starts'; startsAt: number; durationMin: number; beyondHorizon: boolean };

export const DRIZZLE_THRESHOLD_MM_H = 0.1;

export function describeRain(
  steps: RainStep[],
  stepMin: number,
  now: number,
  threshold = DRIZZLE_THRESHOLD_MM_H,
): RainStatement {
  const stepMs = stepMin * 60_000;
  const future = steps.filter((step) => step.time + stepMs > now);
  const last = future.at(-1);
  const first = future[0];
  if (!first || !last) return { kind: 'none' };
  const wet = (step: RainStep): boolean => step.mmPerHour >= threshold;
  const horizonEnd = last.time + stepMs;

  if (first.time <= now && wet(first)) {
    const dry = future.find((step) => !wet(step));
    return { kind: 'raining', endsAt: dry ? dry.time : null, horizonEnd };
  }

  const start = future.findIndex(wet);
  if (start === -1) return { kind: 'none' };
  let run = 0;
  while (future[start + run] && wet(future[start + run]!)) run += 1;
  return {
    kind: 'starts',
    startsAt: future[start]!.time,
    durationMin: run * stepMin,
    beyondHorizon: start + run === future.length,
  };
}

function readSeries(data: unknown, key: string): RainStep[] | null {
  if (typeof data !== 'object' || data === null) return null;
  const list = (data as Record<string, unknown>)[key];
  if (!Array.isArray(list)) return null;
  const steps: RainStep[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) return null;
    const { time, mmPerHour } = item as { time?: unknown; mmPerHour?: unknown };
    const ms = typeof time === 'string' ? Date.parse(time) : Number.NaN;
    if (Number.isNaN(ms) || typeof mmPerHour !== 'number') return null;
    steps.push({ time: ms, mmPerHour });
  }
  return steps;
}

export interface PickedSeries {
  source: 'radar' | 'open-meteo';
  stepMin: 5 | 15;
  steps: RainStep[];
}

const MIN_RADAR_AHEAD_MS = 60 * 60_000;

/** Radar home-cell series while the radar is fresh and reaches an hour ahead, else the Open-Meteo series. */
export function pickRainSeries(
  radar: SourceSnapshot | undefined,
  weather: SourceSnapshot | undefined,
  now: number,
): PickedSeries | null {
  if (radar?.status === 'fresh') {
    const steps = readSeries(radar.data, 'homeSeries');
    const last = steps?.at(-1);
    if (steps && last && last.time >= now + MIN_RADAR_AHEAD_MS) {
      return { source: 'radar', stepMin: 5, steps };
    }
  }
  if (weather && (weather.status === 'fresh' || weather.status === 'stale')) {
    const steps = readSeries(weather.data, 'rainSeries');
    if (steps && steps.length > 0) return { source: 'open-meteo', stepMin: 15, steps };
  }
  return null;
}

/** Aggregates steps into bars of `barMin` minutes (mean intensity). */
export function toBars(steps: RainStep[], stepMin: number, barMin = 15): RainStep[] {
  if (stepMin >= barMin) return steps;
  const barMs = barMin * 60_000;
  const groups = new Map<number, number[]>();
  for (const step of steps) {
    const start = Math.floor(step.time / barMs) * barMs;
    groups.set(start, [...(groups.get(start) ?? []), step.mmPerHour]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, values]) => ({
      time,
      mmPerHour: values.reduce((sum, value) => sum + value, 0) / values.length,
    }));
}
