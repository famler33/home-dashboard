import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdleTab } from './useIdleTab';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Covers: NFR-1, AC-19, AC-37
describe('useIdleTab', () => {
  it('returns to Alle after 60 seconds without input on the wall', () => {
    const { result } = renderHook(() => useIdleTab({ idleReset: true, idleMs: 60_000 }));
    act(() => result.current.select('family'));
    expect(result.current.tab).toBe('family');
    act(() => void vi.advanceTimersByTime(59_000));
    expect(result.current.tab).toBe('family');
    act(() => void vi.advanceTimersByTime(1_000));
    expect(result.current.tab).toBe('all');
  });

  it('restarts the countdown on every input', () => {
    const { result } = renderHook(() => useIdleTab({ idleReset: true, idleMs: 60_000 }));
    act(() => result.current.select('person-1'));
    act(() => void vi.advanceTimersByTime(50_000));
    act(() => result.current.touch());
    act(() => void vi.advanceTimersByTime(50_000));
    expect(result.current.tab).toBe('person-1');
    act(() => void vi.advanceTimersByTime(10_000));
    expect(result.current.tab).toBe('all');
  });

  it('starts no timer while Alle is selected and clears its timer on unmount', () => {
    const { result, unmount } = renderHook(() => useIdleTab({ idleReset: true, idleMs: 60_000 }));
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current.select('family'));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the selected tab on the phone after several minutes', () => {
    const { result } = renderHook(() => useIdleTab({ idleReset: false, idleMs: 60_000 }));
    act(() => result.current.select('person-2'));
    act(() => void vi.advanceTimersByTime(10 * 60_000));
    expect(result.current.tab).toBe('person-2');
    expect(vi.getTimerCount()).toBe(0);
  });
});
