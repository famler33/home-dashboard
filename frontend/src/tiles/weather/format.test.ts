import { describe, expect, it } from 'vitest';
import { compassKey, formatClock, formatWeekday, roundTemperature } from './format';

// Covers: FR-15, AC-4, AC-5, AC-9
describe('weather formatting', () => {
  it('formats ISO times as 24-hour clock times in the given time zone', () => {
    expect(formatClock('2026-10-28T14:00:00.000Z', 'Europe/Berlin')).toBe('15:00');
    expect(formatClock(Date.parse('2026-10-28T22:30:00Z'), 'UTC')).toBe('22:30');
    expect(formatClock('2026-10-28T14:00:00.000Z', 'America/New_York')).toBe('10:00');
  });

  it.each([
    [0, 'N'],
    [360, 'N'],
    [22, 'N'],
    [23, 'NE'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [312, 'NW'],
    [338, 'N'],
    [-45, 'NW'],
  ])('maps %i degrees to %s', (degrees, key) => {
    expect(compassKey(degrees)).toBe(key);
  });

  it('rounds temperatures to whole degrees without a minus zero', () => {
    expect(roundTemperature(12.5)).toBe(13);
    expect(roundTemperature(-0.3)).toBe(0);
    expect(Object.is(roundTemperature(-0.3), -0)).toBe(false);
    expect(roundTemperature(-1.6)).toBe(-2);
  });

  it('formats weekdays in German and independent of the time zone for date strings', () => {
    expect(formatWeekday('2026-10-28', 'de')).toBe('Mi.');
    expect(formatWeekday('2026-11-01', 'de')).toBe('So.');
  });
});
