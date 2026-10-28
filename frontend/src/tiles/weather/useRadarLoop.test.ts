import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRadarLoop } from './useRadarLoop';

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

// Covers: FR-7, NFR-1, AC-16, AC-20
describe('useRadarLoop', () => {
  const options = {
    frameCount: 4,
    startIndex: 2,
    active: true,
    reducedMotion: false,
    stepMs: 450,
    holdMs: 2_000,
  };

  it('starts at the current frame', () => {
    expect(renderHook(() => useRadarLoop(options)).result.current).toBe(2);
  });

  it('steps through all frames, holds the last one, then restarts', async () => {
    const { result } = renderHook(() => useRadarLoop({ ...options, startIndex: 0 }));
    const seen = [result.current];
    for (let i = 0; i < 3; i += 1) {
      await advance(450);
      seen.push(result.current);
    }
    expect(seen).toEqual([0, 1, 2, 3]);
    await advance(1_900);
    expect(result.current).toBe(3);
    await advance(200);
    expect(result.current).toBe(0);
  });

  it('shows one static frame and starts no timer under reduced motion', async () => {
    const { result } = renderHook(() => useRadarLoop({ ...options, reducedMotion: true }));
    expect(vi.getTimerCount()).toBe(0);
    await advance(10_000);
    expect(result.current).toBe(2);
  });

  it('stops while inactive and returns to the current frame', async () => {
    const { result, rerender } = renderHook((props) => useRadarLoop(props), {
      initialProps: { ...options, startIndex: 1 },
    });
    await advance(450);
    expect(result.current).toBe(2);
    rerender({ ...options, startIndex: 1, active: false });
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current).toBe(1);
  });

  it('clears its timer on unmount and copes with an empty frame list', () => {
    const { unmount } = renderHook(() => useRadarLoop(options));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(
      renderHook(() => useRadarLoop({ ...options, frameCount: 0, startIndex: 0 })).result.current,
    ).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
