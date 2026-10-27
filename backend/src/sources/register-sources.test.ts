import { describe, expect, it, vi } from 'vitest';
import { createFakeTime } from '../../test/helpers/fake-time.js';
import { createScheduler } from '../scheduler/scheduler.js';
import { registerSources } from './register-sources.js';
import type { Source } from './source.js';

const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

// Covers: FR-8, FR-10, AC-22, AC-25
describe('registerSources', () => {
  it('refreshes every source on its own interval', async () => {
    const time = createFakeTime();
    const scheduler = createScheduler({ clock: time, timers: time, logger: logger() });
    const refresh = vi.fn(async () => {});
    const fast: Source = {
      id: 'fast',
      intervalSeconds: 10,
      staleAfterSeconds: 20,
      timeoutMs: 1,
      fetch: async () => 1,
    };
    const slow: Source = {
      id: 'slow',
      intervalSeconds: 60,
      staleAfterSeconds: 120,
      timeoutMs: 1,
      fetch: async () => 1,
    };
    registerSources(scheduler, { refresh }, [fast, slow]);

    await time.advance(60_000);
    const calls = refresh.mock.calls.map(([source]) => (source as Source).id);
    expect(calls.filter((id) => id === 'fast')).toHaveLength(7);
    expect(calls.filter((id) => id === 'slow')).toHaveLength(2);
    await scheduler.stop();
  });
});
