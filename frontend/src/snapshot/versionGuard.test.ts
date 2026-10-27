import { describe, expect, it, vi } from 'vitest';
import { createReloader, dailyReloadDue } from './versionGuard';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

// Covers: FR-12, AC-15, AC-16
describe('createReloader', () => {
  it('reloads when asked', () => {
    const reload = vi.fn();
    const reloader = createReloader({ reload, storage: memoryStorage(), now: () => 1_000_000 });
    expect(reloader.requestReload()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads at most once per 60 seconds', () => {
    const reload = vi.fn();
    let now = 1_000_000;
    const reloader = createReloader({ reload, storage: memoryStorage(), now: () => now });
    reloader.requestReload();
    now += 30_000;
    expect(reloader.requestReload()).toBe(false);
    now += 31_000;
    expect(reloader.requestReload()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('shares the guard across page loads through storage', () => {
    const storage = memoryStorage();
    const first = vi.fn();
    const second = vi.fn();
    createReloader({ reload: first, storage, now: () => 5_000_000 }).requestReload();
    const afterReload = createReloader({ reload: second, storage, now: () => 5_010_000 });
    expect(afterReload.requestReload()).toBe(false);
    expect(second).not.toHaveBeenCalled();
  });

  it('still reloads once and guards in memory when storage throws', () => {
    const reload = vi.fn();
    let now = 1_000_000;
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const reloader = createReloader({ reload, storage: throwing, now: () => now });
    expect(reloader.requestReload()).toBe(true);
    now += 1_000;
    expect(reloader.requestReload()).toBe(false);
  });

  it('works without any storage', () => {
    const reload = vi.fn();
    const reloader = createReloader({ reload, storage: null, now: () => 1 });
    expect(reloader.requestReload()).toBe(true);
  });
});

describe('dailyReloadDue', () => {
  const zone = 'Europe/Berlin';
  const at = (iso: string) => Date.parse(iso);

  it('is not due before the daily time', () => {
    expect(
      dailyReloadDue({
        now: at('2026-10-28T02:30:00Z'),
        startedAt: at('2026-10-27T10:00:00Z'),
        timeZone: zone,
        hhmm: '04:00',
      }),
    ).toBe(false);
  });

  it('is due after the daily time when the page started before it', () => {
    expect(
      dailyReloadDue({
        now: at('2026-10-28T03:30:00Z'),
        startedAt: at('2026-10-27T10:00:00Z'),
        timeZone: zone,
        hhmm: '04:00',
      }),
    ).toBe(true);
  });

  it("is not due when the page started after today's daily time", () => {
    expect(
      dailyReloadDue({
        now: at('2026-10-28T09:00:00Z'),
        startedAt: at('2026-10-28T05:00:00Z'),
        timeZone: zone,
        hhmm: '04:00',
      }),
    ).toBe(false);
  });

  it('is due again on the next day', () => {
    expect(
      dailyReloadDue({
        now: at('2026-10-29T03:30:00Z'),
        startedAt: at('2026-10-28T05:00:00Z'),
        timeZone: zone,
        hhmm: '04:00',
      }),
    ).toBe(true);
  });

  it('uses the configured timezone, not the browser timezone', () => {
    // 2026-10-28T03:30Z is 04:30 in Berlin but 23:30 the previous evening in New York
    expect(
      dailyReloadDue({
        now: at('2026-10-28T03:30:00Z'),
        startedAt: at('2026-10-27T10:00:00Z'),
        timeZone: 'America/New_York',
        hhmm: '04:00',
      }),
    ).toBe(false);
  });

  it('stays correct across the DST change night', () => {
    // 2026-10-25 04:00 Berlin = 03:00Z (CET after the change); page started the evening before
    expect(
      dailyReloadDue({
        now: at('2026-10-25T03:10:00Z'),
        startedAt: at('2026-10-24T20:00:00Z'),
        timeZone: zone,
        hhmm: '04:00',
      }),
    ).toBe(true);
    expect(
      dailyReloadDue({
        now: at('2026-10-25T02:50:00Z'),
        startedAt: at('2026-10-24T20:00:00Z'),
        timeZone: zone,
        hhmm: '04:00',
      }),
    ).toBe(false);
  });
});
