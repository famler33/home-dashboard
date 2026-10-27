import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { driftOffsets, useBurnInDrift } from './useBurnInDrift';

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

// Covers: FR-13, AC-7, AC-18
describe('useBurnInDrift', () => {
  it('advances through 8 offsets every 5 minutes within 8px', async () => {
    const { result } = renderHook(() =>
      useBurnInDrift({ enabled: true, theme: 'night', reducedMotion: false }),
    );
    const seen: string[] = [];
    for (let step = 0; step < 8; step += 1) {
      seen.push(`${result.current.x},${result.current.y}`);
      expect(Math.abs(result.current.x)).toBeLessThanOrEqual(8);
      expect(Math.abs(result.current.y)).toBeLessThanOrEqual(8);
      await advance(5 * 60_000);
    }
    expect(new Set(seen).size).toBe(8);
    expect(`${result.current.x},${result.current.y}`).toBe(seen[0]);
  });

  it('never repeats the same offset twice in a row', () => {
    for (let i = 0; i < driftOffsets.length; i += 1) {
      const next = driftOffsets[(i + 1) % driftOffsets.length];
      expect(next).not.toEqual(driftOffsets[i]);
    }
  });

  it('uses half the amplitude by day', async () => {
    const day = renderHook(() =>
      useBurnInDrift({ enabled: true, theme: 'day', reducedMotion: false }),
    );
    const night = renderHook(() =>
      useBurnInDrift({ enabled: true, theme: 'night', reducedMotion: false }),
    );
    await advance(5 * 60_000);
    expect(Math.abs(day.result.current.x)).toBeLessThanOrEqual(
      Math.abs(night.result.current.x) / 2 + 0.5,
    );
  });

  it('does not drift in phone layout', async () => {
    const { result } = renderHook(() =>
      useBurnInDrift({ enabled: false, theme: 'night', reducedMotion: false }),
    );
    await advance(10 * 60_000);
    expect(result.current).toEqual({ x: 0, y: 0, animate: false });
  });

  it('steps instantly without a transition under reduced motion', async () => {
    const { result } = renderHook(() =>
      useBurnInDrift({ enabled: true, theme: 'night', reducedMotion: true }),
    );
    const first = { x: result.current.x, y: result.current.y };
    await advance(5 * 60_000);
    expect({ x: result.current.x, y: result.current.y }).not.toEqual(first);
    expect(result.current.animate).toBe(false);
  });

  it('animates the step when motion is allowed', () => {
    const { result } = renderHook(() =>
      useBurnInDrift({ enabled: true, theme: 'night', reducedMotion: false }),
    );
    expect(result.current.animate).toBe(true);
  });

  it('clears its interval on unmount', () => {
    const { unmount } = renderHook(() =>
      useBurnInDrift({ enabled: true, theme: 'night', reducedMotion: false }),
    );
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
