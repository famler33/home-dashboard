import { describe, expect, it } from 'vitest';
import { wmoToCondition } from './conditions.js';

// Covers: FR-2, AC-3
describe('wmoToCondition', () => {
  it.each([
    [0, 'clear'],
    [1, 'mostly-clear'],
    [2, 'partly-cloudy'],
    [3, 'overcast'],
    [45, 'fog'],
    [48, 'fog'],
    [51, 'drizzle'],
    [53, 'drizzle'],
    [55, 'drizzle'],
    [56, 'drizzle'],
    [57, 'drizzle'],
    [61, 'rain'],
    [63, 'rain'],
    [65, 'rain'],
    [66, 'rain'],
    [67, 'rain'],
    [71, 'snow'],
    [73, 'snow'],
    [75, 'snow'],
    [77, 'snow'],
    [80, 'showers'],
    [81, 'showers'],
    [82, 'showers'],
    [85, 'snow'],
    [86, 'snow'],
    [95, 'thunderstorm'],
    [96, 'thunderstorm'],
    [97, 'thunderstorm'],
    [99, 'thunderstorm'],
  ])('maps WMO code %i to %s', (code, expected) => {
    expect(wmoToCondition(code)).toBe(expected);
  });

  it.each([[4], [-1], [100], [60], [Number.NaN], [null], [undefined], ['61']])(
    'maps unknown or missing code %s to unknown',
    (code) => {
      expect(wmoToCondition(code as number)).toBe('unknown');
    },
  );
});
