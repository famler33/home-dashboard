import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewRotation } from './useViewRotation';

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const options = { viewCount: 3, dwellMs: 15_000, resumeMs: 60_000, autoplay: true };

beforeEach(() => {
  vi.useFakeTimers();
});

// Covers: FR-9, NFR-1, AC-22, AC-23, AC-26, AC-27, AC-44, AC-45
describe('useViewRotation', () => {
  it('advances every 15 seconds through all views and wraps around', async () => {
    const { result } = renderHook(() => useViewRotation(options));
    expect(result.current.index).toBe(0);
    await advance(15_000);
    expect(result.current.index).toBe(1);
    await advance(15_000);
    expect(result.current.index).toBe(2);
    await advance(15_000);
    expect(result.current.index).toBe(0);
  });

  it('advances on next and goes back on prev, both wrapping, and pauses', () => {
    const { result } = renderHook(() => useViewRotation(options));
    act(() => result.current.prev());
    expect(result.current.index).toBe(2);
    expect(result.current.paused).toBe(true);
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
  });

  it('jumps straight to a view and pauses', () => {
    const { result } = renderHook(() => useViewRotation(options));
    act(() => result.current.goTo(2));
    expect(result.current.index).toBe(2);
    expect(result.current.paused).toBe(true);
  });

  it('resumes after 60 seconds without input and then advances after the dwell time', async () => {
    const { result } = renderHook(() => useViewRotation(options));
    act(() => result.current.next());
    await advance(59_000);
    expect(result.current.paused).toBe(true);
    expect(result.current.index).toBe(1);
    await advance(1_000);
    expect(result.current.paused).toBe(false);
    await advance(15_000);
    expect(result.current.index).toBe(2);
  });

  it('restarts the resume timer on every input', async () => {
    const { result } = renderHook(() => useViewRotation(options));
    act(() => result.current.next());
    await advance(40_000);
    act(() => result.current.next());
    await advance(40_000);
    expect(result.current.paused).toBe(true);
    await advance(20_000);
    expect(result.current.paused).toBe(false);
  });

  it('keeps the index while paused even after the dwell time', async () => {
    const { result } = renderHook(() => useViewRotation(options));
    act(() => result.current.goTo(1));
    await advance(30_000);
    expect(result.current.index).toBe(1);
  });

  it('starts no timer when autoplay is off but still switches manually', async () => {
    const { result } = renderHook(() => useViewRotation({ ...options, autoplay: false }));
    expect(vi.getTimerCount()).toBe(0);
    await advance(120_000);
    expect(result.current.index).toBe(0);
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops the automatic rotation when autoplay turns off', async () => {
    const { result, rerender } = renderHook((props) => useViewRotation(props), {
      initialProps: options,
    });
    await advance(15_000);
    expect(result.current.index).toBe(1);
    rerender({ ...options, autoplay: false });
    expect(vi.getTimerCount()).toBe(0);
    await advance(60_000);
    expect(result.current.index).toBe(1);
  });

  it('clears its timers on unmount', () => {
    const { unmount } = renderHook(() => useViewRotation(options));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
