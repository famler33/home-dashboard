import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchSnapshot } from '../api/client';
import type { Snapshot } from '../api/types';
import { SnapshotContext, type SnapshotContextValue } from './snapshot-context';
import {
  createReloader,
  dailyReloadDue,
  localDateKey,
  safeSessionStorage,
  type GuardStorage,
} from './versionGuard';

const DEFAULT_POLL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const TICK_MS = 15_000;
const OFFLINE_AFTER_FAILURES = 2;

interface Props {
  pollMs?: number;
  timeoutMs?: number;
  bundledBuildId?: string;
  fetcher?: (signal: AbortSignal) => Promise<Snapshot>;
  reload?: () => void;
  storage?: GuardStorage | null;
  children: ReactNode;
}

export function SnapshotProvider({
  pollMs = DEFAULT_POLL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  bundledBuildId = __BUILD_ID__,
  fetcher = (signal) => fetchSnapshot(signal),
  reload = () => window.location.reload(),
  storage,
  children,
}: Props) {
  const [state, setState] = useState<SnapshotContextValue>(() => ({
    snapshot: null,
    receivedAtMonotonic: null,
    nowMono: performance.now(),
    offline: false,
  }));

  const latest = useRef({ fetcher, reload, storage, bundledBuildId, timeoutMs });
  useEffect(() => {
    latest.current = { fetcher, reload, storage, bundledBuildId, timeoutMs };
  });

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let failures = 0;
    const startedAt = Date.now();
    let lastDailyKey = '';

    const reloader = createReloader({
      reload: () => latest.current.reload(),
      storage: latest.current.storage === undefined ? safeSessionStorage() : latest.current.storage,
      now: () => Date.now(),
    });

    async function poll(): Promise<void> {
      if (inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), latest.current.timeoutMs);
      try {
        const snapshot = await Promise.race([
          latest.current.fetcher(controller.signal),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () => reject(new Error('timeout')), {
              once: true,
            });
          }),
        ]);
        if (!active) return;
        failures = 0;
        const mono = performance.now();
        setState({ snapshot, receivedAtMonotonic: mono, nowMono: mono, offline: false });

        const { bundledBuildId: bundled } = latest.current;
        if (bundled !== 'dev' && snapshot.buildId !== bundled) {
          reloader.requestReload();
          return;
        }
        const { timezone, display } = snapshot.settings;
        const now = Date.now();
        const dayKey = localDateKey(now, timezone);
        if (
          lastDailyKey !== dayKey &&
          dailyReloadDue({ now, startedAt, timeZone: timezone, hhmm: display.dailyReloadAt })
        ) {
          lastDailyKey = dayKey;
          reloader.requestReload();
        }
      } catch {
        if (!active) return;
        failures += 1;
        if (failures >= OFFLINE_AFTER_FAILURES) {
          setState((previous) => ({ ...previous, offline: true, nowMono: performance.now() }));
        }
      } finally {
        clearTimeout(timer);
        inFlight = false;
      }
    }

    void poll();
    const pollTimer = setInterval(() => void poll(), pollMs);
    const tickTimer = setInterval(
      () => setState((previous) => ({ ...previous, nowMono: performance.now() })),
      TICK_MS,
    );

    return () => {
      active = false;
      clearInterval(pollTimer);
      clearInterval(tickTimer);
    };
  }, [pollMs]);

  const value = useMemo(() => state, [state]);
  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}
