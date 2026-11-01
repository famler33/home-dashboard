import type { Clock } from '../clock.js';
import type { Logger } from '../logger.js';
import { nextDailyRun } from './next-daily-run.js';

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface Scheduler {
  every(
    name: string,
    intervalMs: number,
    job: () => Promise<void>,
    opts?: { runAtStart?: boolean },
  ): void;
  dailyAt(name: string, hhmm: string, timeZone: string, job: () => Promise<void>): void;
  stop(): Promise<void>;
}

export { nextDailyRun };

export function createScheduler(deps: { clock: Clock; timers: Timers; logger: Logger }): Scheduler {
  const { clock, timers, logger } = deps;
  const handles = new Map<string, unknown>();
  const running = new Set<Promise<void>>();
  let stopped = false;

  function register(
    name: string,
    job: () => Promise<void>,
    firstDelay: number,
    nextDelay: () => number,
  ): void {
    if (handles.has(name)) throw new Error(`job ${name} is already registered`);

    const run = async (): Promise<void> => {
      if (stopped) return;
      const execution = (async () => {
        try {
          await job();
        } catch (error) {
          logger.warn(
            { job: name, errorClass: error instanceof Error ? error.name : 'unknown' },
            'scheduled job failed',
          );
        }
      })();
      running.add(execution);
      await execution;
      running.delete(execution);
      if (!stopped)
        handles.set(
          name,
          timers.setTimeout(() => void run(), nextDelay()),
        );
    };

    handles.set(
      name,
      timers.setTimeout(() => void run(), firstDelay),
    );
  }

  return {
    every(name, intervalMs, job, opts) {
      const runAtStart = opts?.runAtStart ?? true;
      register(name, job, runAtStart ? 0 : intervalMs, () => intervalMs);
    },
    dailyAt(name, hhmm, timeZone, job) {
      let lastTarget = 0;
      const delayToNext = (): number => {
        const target = nextDailyRun(Math.max(clock.now(), lastTarget), hhmm, timeZone);
        lastTarget = target;
        return Math.max(0, target - clock.now());
      };
      register(name, job, delayToNext(), delayToNext);
    },
    async stop() {
      stopped = true;
      for (const handle of handles.values()) timers.clearTimeout(handle);
      handles.clear();
      await Promise.allSettled([...running]);
    },
  };
}
