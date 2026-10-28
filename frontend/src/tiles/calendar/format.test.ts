import { describe, expect, it } from 'vitest';
import { formatDayDate, formatTime } from './format';

// Covers: AC-5, AC-10
describe('calendar formatting', () => {
  it('formats times in the settings time zone with 24 hours', () => {
    expect(formatTime('2026-10-28T13:30:00.000Z', 'Europe/Berlin')).toBe('14:30');
    expect(formatTime('2026-10-28T13:30:00.000Z', 'America/New_York')).toBe('09:30');
    expect(formatTime('2026-10-28T06:05:00.000Z', 'Europe/Berlin')).toBe('07:05');
  });

  it('formats a day heading as weekday and date', () => {
    expect(formatDayDate('2026-10-31', 'de')).toBe('Sa. 31.10.');
    expect(formatDayDate('2026-11-02', 'de')).toBe('Mo. 02.11.');
  });
});
