import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockMatchMedia } from '../test-utils';
import { useKioskMode } from './useKioskMode';

interface Sentinel extends EventTarget {
  release: ReturnType<typeof vi.fn>;
}

let fullscreenElement: Element | null = null;
let requestFullscreen: ReturnType<typeof vi.fn>;
let sentinels: Sentinel[];
let wakeLockRequest: ReturnType<typeof vi.fn>;

function defineWakeLock(available: boolean): void {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: available });
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: available ? { request: wakeLockRequest } : undefined,
  });
}

beforeEach(() => {
  fullscreenElement = null;
  sentinels = [];
  requestFullscreen = vi.fn(async () => {
    fullscreenElement = document.documentElement;
    document.dispatchEvent(new Event('fullscreenchange'));
  });
  wakeLockRequest = vi.fn(async () => {
    const sentinel = Object.assign(new EventTarget(), {
      release: vi.fn(async () => {}),
    }) as Sentinel;
    sentinels.push(sentinel);
    return sentinel;
  });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => fullscreenElement,
  });
  document.documentElement.requestFullscreen = requestFullscreen as unknown as () => Promise<void>;
  defineWakeLock(true);
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
  Reflect.deleteProperty(document, 'fullscreenElement');
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
});

const tap = () =>
  act(async () => {
    document.dispatchEvent(new Event('pointerup'));
  });

// Covers: FR-16, AC-38
describe('useKioskMode', () => {
  it('requests fullscreen on the first pointerup', async () => {
    renderHook(() => useKioskMode({ enabled: true }));
    await tap();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('shows the tap hint only while fullscreen is available and inactive', async () => {
    const { result } = renderHook(() => useKioskMode({ enabled: true }));
    expect(result.current.showHint).toBe(true);
    await tap();
    expect(result.current.showHint).toBe(false);
    fullscreenElement = null;
    await act(async () => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(result.current.showHint).toBe(true);
  });

  it('does nothing in phone layout', async () => {
    const { result } = renderHook(() => useKioskMode({ enabled: false }));
    await tap();
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(result.current.showHint).toBe(false);
    expect(wakeLockRequest).not.toHaveBeenCalled();
  });

  it('shows no hint and does not request fullscreen in standalone mode', async () => {
    mockMatchMedia((query) => query.includes('display-mode: standalone'));
    const { result } = renderHook(() => useKioskMode({ enabled: true }));
    await tap();
    expect(result.current.showHint).toBe(false);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('shows no hint when fullscreen is unsupported', () => {
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
    const { result } = renderHook(() => useKioskMode({ enabled: true }));
    expect(result.current.showHint).toBe(false);
  });

  it('requests the wake lock again after release and on visibilitychange', async () => {
    renderHook(() => useKioskMode({ enabled: true }));
    await act(async () => {});
    expect(wakeLockRequest).toHaveBeenCalledTimes(1);

    await act(async () => {
      sentinels[0]?.dispatchEvent(new Event('release'));
    });
    expect(wakeLockRequest).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(wakeLockRequest).toHaveBeenCalledTimes(3);
  });

  it('does nothing and does not throw when the wake lock API is unavailable', async () => {
    defineWakeLock(false);
    expect(() => renderHook(() => useKioskMode({ enabled: true }))).not.toThrow();
    await act(async () => {});
    expect(wakeLockRequest).not.toHaveBeenCalled();
  });

  it('swallows fullscreen and wake lock rejections', async () => {
    requestFullscreen.mockRejectedValue(new Error('denied'));
    wakeLockRequest.mockRejectedValue(new Error('denied'));
    renderHook(() => useKioskMode({ enabled: true }));
    await act(async () => {});
    await expect(tap()).resolves.not.toThrow();
  });

  it('releases the wake lock and removes listeners on unmount', async () => {
    const { unmount } = renderHook(() => useKioskMode({ enabled: true }));
    await act(async () => {});
    unmount();
    expect(sentinels[0]?.release).toHaveBeenCalled();
    await tap();
    expect(requestFullscreen).not.toHaveBeenCalled();
  });
});
