import { describe, expect, it } from 'vitest';
import { sourceFixture } from '../../test-fixtures';
import { describeRain, pickRainSeries, toBars, type RainStep } from './rain';

const at = (hhmm: string) => Date.parse(`2026-10-28T${hhmm}:00Z`);
const steps = (start: string, stepMin: number, values: number[]): RainStep[] =>
  values.map((mmPerHour, index) => ({ time: at(start) + index * stepMin * 60_000, mmPerHour }));

// Covers: FR-6, AC-12, AC-13, AC-14, AC-15
describe('describeRain', () => {
  it('says none when nothing wet is ahead', () => {
    expect(describeRain(steps('14:00', 15, [0, 0, 0, 0]), 15, at('14:05'))).toEqual({
      kind: 'none',
    });
  });

  it('describes the start time and duration of the next rain', () => {
    const result = describeRain(steps('14:00', 15, [0, 0.4, 1, 0.5, 0, 0, 0, 0]), 15, at('14:05'));
    expect(result).toEqual({
      kind: 'starts',
      startsAt: at('14:15'),
      durationMin: 45,
      beyondHorizon: false,
    });
  });

  it('describes the expected end when it rains now', () => {
    const result = describeRain(steps('13:45', 15, [0.5, 0.5, 0, 0, 0, 0]), 15, at('13:50'));
    expect(result).toEqual({ kind: 'raining', endsAt: at('14:15'), horizonEnd: at('15:15') });
  });

  it('states that rain continues beyond the horizon', () => {
    const raining = describeRain(steps('13:45', 15, [1, 1, 1, 1]), 15, at('13:50'));
    expect(raining).toEqual({ kind: 'raining', endsAt: null, horizonEnd: at('14:45') });
    const starts = describeRain(steps('14:00', 15, [0, 0, 1, 1]), 15, at('14:05'));
    expect(starts).toEqual({
      kind: 'starts',
      startsAt: at('14:30'),
      durationMin: 30,
      beyondHorizon: true,
    });
  });

  it('ignores steps below 0.1 mm/h and counts 0.1 as rain', () => {
    expect(describeRain(steps('14:00', 15, [0.09, 0.09, 0.05]), 15, at('14:00'))).toEqual({
      kind: 'none',
    });
    expect(describeRain(steps('14:00', 15, [0, 0.1]), 15, at('14:00')).kind).toBe('starts');
  });

  it('ignores steps that already ended', () => {
    expect(describeRain(steps('13:00', 15, [2, 2, 0, 0, 0, 0, 0, 0]), 15, at('13:40'))).toEqual({
      kind: 'none',
    });
  });

  it('works with five-minute radar steps', () => {
    const result = describeRain(steps('14:00', 5, [0, 0, 0, 0.3, 0.3, 0.3, 0, 0]), 5, at('14:01'));
    expect(result).toEqual({
      kind: 'starts',
      startsAt: at('14:15'),
      durationMin: 15,
      beyondHorizon: false,
    });
  });

  it('returns none for an empty series', () => {
    expect(describeRain([], 15, at('14:00'))).toEqual({ kind: 'none' });
  });
});

describe('pickRainSeries', () => {
  const now = at('13:50');
  const radarSeries = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      time: new Date(now - 3_600_000 + index * 300_000).toISOString(),
      mmPerHour: 0,
    }));
  const radar = (count: number, status: 'fresh' | 'stale' | 'error' = 'fresh') =>
    sourceFixture({
      id: 'weather-radar',
      status,
      data: { version: 'v', frames: [], homeSeries: radarSeries(count) },
    });
  const weather = (status: 'fresh' | 'stale' | 'error' | 'never-loaded' = 'fresh') =>
    sourceFixture({
      id: 'weather',
      status,
      data: {
        rainSeries: Array.from({ length: 16 }, (_, index) => ({
          time: new Date(now + index * 900_000).toISOString(),
          mmPerHour: 0,
        })),
      },
    });

  it('uses the radar series while it is fresh and covers at least 60 minutes ahead', () => {
    const picked = pickRainSeries(radar(37), weather(), now);
    expect(picked?.source).toBe('radar');
    expect(picked?.stepMin).toBe(5);
  });

  it('falls back to Open-Meteo when the radar is stale, failed or too short', () => {
    expect(pickRainSeries(radar(37, 'stale'), weather(), now)?.source).toBe('open-meteo');
    expect(pickRainSeries(radar(37, 'error'), weather(), now)?.source).toBe('open-meteo');
    expect(pickRainSeries(radar(14), weather(), now)?.source).toBe('open-meteo');
    expect(pickRainSeries(undefined, weather(), now)?.stepMin).toBe(15);
  });

  it('still uses the last Open-Meteo series while stale, and returns null when nothing is usable', () => {
    expect(pickRainSeries(undefined, weather('stale'), now)?.source).toBe('open-meteo');
    expect(pickRainSeries(radar(10, 'error'), weather('never-loaded'), now)).toBeNull();
    expect(pickRainSeries(undefined, undefined, now)).toBeNull();
  });
});

describe('toBars', () => {
  it('averages five-minute steps into 15-minute bars', () => {
    const bars = toBars(steps('14:00', 5, [0, 0.3, 0.6, 1.2, 1.2, 1.2]), 5);
    expect(bars).toEqual([
      { time: at('14:00'), mmPerHour: 0.3 },
      { time: at('14:15'), mmPerHour: 1.2 },
    ]);
  });

  it('keeps 15-minute steps unchanged', () => {
    const input = steps('14:00', 15, [0, 1, 2]);
    expect(toBars(input, 15)).toEqual(input);
  });
});
