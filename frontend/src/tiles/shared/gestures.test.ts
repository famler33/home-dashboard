import { describe, expect, it } from 'vitest';
import { classifyGesture } from './gestures';

// Covers: AC-23, AC-44
describe('classifyGesture', () => {
  it.each([
    [{ dx: -60, dy: 0 }, 'swipe-left'],
    [{ dx: -120, dy: 30 }, 'swipe-left'],
    [{ dx: 60, dy: 0 }, 'swipe-right'],
    [{ dx: 200, dy: -50 }, 'swipe-right'],
  ])('treats %j as %s', (move, expected) => {
    expect(classifyGesture(move)).toBe(expected);
  });

  it.each([
    [{ dx: 59, dy: 0 }],
    [{ dx: -59, dy: 5 }],
    [{ dx: 90, dy: 80 }],
    [{ dx: 0, dy: 120 }],
    [{ dx: 30, dy: 30 }],
  ])('does not treat %j as a swipe or a tap', (move) => {
    expect(classifyGesture(move)).toBe('none');
  });

  it.each([[{ dx: 0, dy: 0 }], [{ dx: 9, dy: -9 }], [{ dx: -5, dy: 3 }]])(
    'treats %j as a tap',
    (move) => {
      expect(classifyGesture(move)).toBe('tap');
    },
  );

  it('requires the horizontal part to dominate by a factor of 1.5', () => {
    expect(classifyGesture({ dx: 90, dy: 61 })).toBe('none');
    expect(classifyGesture({ dx: 90, dy: 60 })).toBe('swipe-right');
  });
});
