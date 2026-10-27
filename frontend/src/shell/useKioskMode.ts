import { useEffect, useState } from 'react';

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface WakeLockSentinelLike extends EventTarget {
  release(): Promise<void>;
}

interface WakeLockNavigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
}

function requestFullscreenFn(): (() => Promise<void> | void) | undefined {
  const root = document.documentElement as FullscreenElement;
  if (typeof root.requestFullscreen === 'function') return () => root.requestFullscreen();
  if (typeof root.webkitRequestFullscreen === 'function')
    return () => root.webkitRequestFullscreen?.();
  return undefined;
}

export function useKioskMode(args: { enabled: boolean }): { showHint: boolean } {
  const { enabled } = args;
  const [fullscreen, setFullscreen] = useState(() => document.fullscreenElement != null);

  const supported = requestFullscreenFn() !== undefined;
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    if (!enabled) return undefined;

    const syncFullscreen = (): void => setFullscreen(document.fullscreenElement != null);
    const onPointerUp = (): void => {
      const request = requestFullscreenFn();
      if (!request || document.fullscreenElement != null) return;
      if (window.matchMedia('(display-mode: standalone)').matches) return;
      try {
        void Promise.resolve(request()).catch(() => {});
      } catch {
        // Fullscreen can be refused by the browser; the hint stays visible.
      }
    };

    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);

    // The Wake Lock API needs a secure context; over plain HTTP the tablet settings keep it awake.
    const lockApi = (navigator as WakeLockNavigator).wakeLock;
    let cancelled = false;
    let sentinel: WakeLockSentinelLike | null = null;

    const acquire = async (): Promise<void> => {
      if (!lockApi || !window.isSecureContext || cancelled) return;
      try {
        await sentinel?.release().catch(() => {});
        const next = await lockApi.request('screen');
        if (cancelled) {
          await next.release().catch(() => {});
          return;
        }
        sentinel = next;
        next.addEventListener('release', () => void acquire());
      } catch {
        // Denied or unsupported: nothing to do.
      }
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);

  return { showHint: enabled && supported && !standalone && !fullscreen };
}
