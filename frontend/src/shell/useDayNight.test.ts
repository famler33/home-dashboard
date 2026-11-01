import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isNight, useDayNight } from './useDayNight';

const berlin = 'Europe/Berlin';
// Berlin is UTC+1 on 2026-10-28 and UTC+2 in summer.
const at = (iso: string) => Date.parse(iso);

// Covers: FR-13, AC-17, AC-40
describe('isNight', () => {
  it.each([
    ['21:59', '2026-10-28T20:59:00Z', false],
    ['22:00', '2026-10-28T21:00:00Z', true],
    ['00:30', '2026-10-28T23:30:00Z', true],
    ['06:29', '2026-10-28T05:29:00Z', true],
    ['06:30', '2026-10-28T05:30:00Z', false],
    ['12:00', '2026-10-28T11:00:00Z', false],
  ])('at %s Berlin time is night=%s', (_label, iso, expected) => {
    expect(isNight(at(iso), berlin, '22:00', '06:30')).toBe(expected);
  });

  it('supports ranges that do not cross midnight', () => {
    expect(isNight(at('2026-10-28T13:30:00Z'), berlin, '13:00', '15:00')).toBe(true);
    expect(isNight(at('2026-10-28T15:30:00Z'), berlin, '13:00', '15:00')).toBe(false);
  });

  it('is never night when the bounds are equal', () => {
    expect(isNight(at('2026-10-28T21:00:00Z'), berlin, '22:00', '22:00')).toBe(false);
  });

  it('evaluates the schedule in the configured timezone, not the browser timezone', () => {
    // 21:30Z is 22:30 in Berlin but 17:30 in New York
    const instant = at('2026-10-28T21:30:00Z');
    expect(isNight(instant, 'Europe/Berlin', '22:00', '06:30')).toBe(true);
    expect(isNight(instant, 'America/New_York', '22:00', '06:30')).toBe(false);
  });

  it('stays correct across the DST change nights', () => {
    expect(isNight(at('2026-03-28T21:30:00Z'), berlin, '22:00', '06:30')).toBe(true); // 22:30 CET
    expect(isNight(at('2026-03-29T20:30:00Z'), berlin, '22:00', '06:30')).toBe(true); // 22:30 CEST
    expect(isNight(at('2026-03-29T19:30:00Z'), berlin, '22:00', '06:30')).toBe(false); // 21:30 CEST
    expect(isNight(at('2026-10-25T20:30:00Z'), berlin, '22:00', '06:30')).toBe(false); // 21:30 CET
    expect(isNight(at('2026-10-25T21:30:00Z'), berlin, '22:00', '06:30')).toBe(true); // 22:30 CET
  });
});

describe('useDayNight', () => {
  const settings = {
    timezone: berlin,
    display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
  };

  beforeEach(() => {
    vi.useFakeTimers({ now: at('2026-10-28T20:59:50Z') });
    document.documentElement.removeAttribute('data-theme');
  });

  it('switches the theme at the configured time without reload', async () => {
    const { result } = renderHook(() => useDayNight(settings));
    expect(result.current).toBe('day');
    expect(document.documentElement.dataset['theme']).toBe('day');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });
    expect(result.current).toBe('night');
    expect(document.documentElement.dataset['theme']).toBe('night');
  });

  it('falls back to day before settings are known', () => {
    const { result } = renderHook(() => useDayNight(undefined));
    expect(result.current).toBe('day');
  });

  it('clears its interval on unmount', () => {
    const { unmount } = renderHook(() => useDayNight(settings));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
