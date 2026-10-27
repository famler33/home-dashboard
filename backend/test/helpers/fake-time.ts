import type { Clock } from '../../src/clock.js';
import type { Timers } from '../../src/scheduler/scheduler.js';

interface Pending {
  id: number;
  at: number;
  fn: () => void;
}

export interface FakeTime extends Clock, Timers {
  advance(ms: number): Promise<void>;
  pendingCount(): number;
}

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export function createFakeTime(start = Date.UTC(2026, 9, 28, 12, 0, 0)): FakeTime {
  let current = start;
  let nextId = 1;
  let pending: Pending[] = [];

  return {
    now: () => current,
    setTimeout(fn, ms) {
      const entry = { id: nextId++, at: current + Math.max(0, ms), fn };
      pending.push(entry);
      return entry.id;
    },
    clearTimeout(handle) {
      pending = pending.filter((entry) => entry.id !== handle);
    },
    pendingCount: () => pending.length,
    async advance(ms) {
      const target = current + ms;
      await flush();
      for (;;) {
        const due = pending
          .filter((entry) => entry.at <= target)
          .sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        pending = pending.filter((entry) => entry.id !== due.id);
        current = Math.max(current, due.at);
        due.fn();
        await flush();
      }
      current = target;
      await flush();
    },
  };
}
