import { describe, expect, it } from 'vitest';
import { nextDailyRun } from './next-daily-run.js';

const berlin = 'Europe/Berlin';
const iso = (ms: number): string => new Date(ms).toISOString();

// Covers: FR-8, FR-23, AC-22, AC-41
describe('nextDailyRun', () => {
  it('returns today when the time is still ahead', () => {
    const now = Date.UTC(2026, 9, 28, 1, 0, 0); // 02:00 CET... 28 Oct 2026 is CET (UTC+1)
    expect(iso(nextDailyRun(now, '03:00', berlin))).toBe('2026-10-28T02:00:00.000Z');
  });

  it('returns tomorrow when the time has passed', () => {
    const now = Date.UTC(2026, 9, 28, 5, 0, 0);
    expect(iso(nextDailyRun(now, '03:00', berlin))).toBe('2026-10-29T02:00:00.000Z');
  });

  it('is strictly after now when now equals the scheduled instant', () => {
    const now = Date.UTC(2026, 9, 28, 2, 0, 0);
    expect(iso(nextDailyRun(now, '03:00', berlin))).toBe('2026-10-29T02:00:00.000Z');
  });

  it('uses the summer offset in summer', () => {
    const now = Date.UTC(2026, 6, 1, 0, 0, 0);
    expect(iso(nextDailyRun(now, '03:00', berlin))).toBe('2026-07-01T01:00:00.000Z');
  });

  it('interprets a time inside the spring-forward gap with the pre-transition offset', () => {
    // 2026-03-29 02:30 does not exist in Berlin (02:00 -> 03:00)
    const now = Date.UTC(2026, 2, 29, 0, 0, 0);
    expect(iso(nextDailyRun(now, '02:30', berlin))).toBe('2026-03-29T01:30:00.000Z');
  });

  it('picks the first occurrence in the autumn repeated hour', () => {
    // 2026-10-25 02:30 happens twice in Berlin (CEST then CET)
    const now = Date.UTC(2026, 9, 24, 22, 0, 0);
    expect(iso(nextDailyRun(now, '02:30', berlin))).toBe('2026-10-25T00:30:00.000Z');
  });

  it('runs on the following day after the repeated hour was used', () => {
    const now = Date.UTC(2026, 9, 25, 0, 30, 0);
    expect(iso(nextDailyRun(now, '02:30', berlin))).toBe('2026-10-26T01:30:00.000Z');
  });

  it('works for time zones without daylight saving', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    expect(iso(nextDailyRun(now, '06:15', 'Asia/Kolkata'))).toBe('2026-01-01T00:45:00.000Z');
  });
});
