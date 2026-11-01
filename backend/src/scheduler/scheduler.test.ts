import { describe, expect, it, vi } from 'vitest';
import { createFakeTime } from '../../test/helpers/fake-time.js';
import { createScheduler } from './scheduler.js';

const silentLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

// Covers: FR-8, FR-10, AC-22, AC-25
describe('createScheduler', () => {
  it('runs the job at start and then after each interval', async () => {
    const time = createFakeTime();
    const scheduler = createScheduler({ clock: time, timers: time, logger: silentLogger() });
    const job = vi.fn(async () => {});
    scheduler.every('demo', 60_000, job);

    await time.advance(0);
    expect(job).toHaveBeenCalledTimes(1);
    await time.advance(60_000);
    expect(job).toHaveBeenCalledTimes(2);
    await time.advance(120_000);
    expect(job).toHaveBeenCalledTimes(4);
    await scheduler.stop();
  });

  it('can skip the run at start', async () => {
    const time = createFakeTime();
    const scheduler = createScheduler({ clock: time, timers: time, logger: silentLogger() });
    const job = vi.fn(async () => {});
    scheduler.every('demo', 60_000, job, { runAtStart: false });

    await time.advance(59_000);
    expect(job).not.toHaveBeenCalled();
    await time.advance(1_000);
    expect(job).toHaveBeenCalledTimes(1);
    await scheduler.stop();
  });

  it('never starts a job again while the previous run is pending', async () => {
    const time = createFakeTime();
    const scheduler = createScheduler({ clock: time, timers: time, logger: silentLogger() });
    let release: () => void = () => {};
    const job = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    scheduler.every('slow', 10_000, job);

    await time.advance(0);
    await time.advance(100_000);
    expect(job).toHaveBeenCalledTimes(1);

    release();
    await time.advance(10_000);
    expect(job).toHaveBeenCalledTimes(2);
    release();
    await scheduler.stop();
  });

  it('continues scheduling after a job throws synchronously or rejects', async () => {
    const time = createFakeTime();
    const logger = silentLogger();
    const scheduler = createScheduler({ clock: time, timers: time, logger });
    const rejecting = vi.fn(async () => {
      throw new Error('boom SECRET-LEAK');
    });
    const throwing = vi.fn(() => {
      throw new TypeError('sync boom SECRET-LEAK');
    });
    scheduler.every('a', 1_000, rejecting);
    scheduler.every('b', 1_000, throwing as unknown as () => Promise<void>);

    await time.advance(3_000);
    expect(rejecting).toHaveBeenCalledTimes(4);
    expect(throwing).toHaveBeenCalledTimes(4);
    expect(logger.warn).toHaveBeenCalled();
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logged).toContain('"job":"a"');
    expect(logged).not.toContain('SECRET-LEAK');
    await scheduler.stop();
  });

  it('keeps independent jobs running when another one fails', async () => {
    const time = createFakeTime();
    const scheduler = createScheduler({ clock: time, timers: time, logger: silentLogger() });
    const healthy = vi.fn(async () => {});
    scheduler.every('bad', 1_000, async () => {
      throw new Error('x');
    });
    scheduler.every('good', 1_000, healthy);

    await time.advance(5_000);
    expect(healthy).toHaveBeenCalledTimes(6);
    await scheduler.stop();
  });

  it('runs a daily job at the next occurrence and again the following day', async () => {
    const time = createFakeTime(Date.UTC(2026, 9, 28, 0, 0, 0)); // 01:00 Berlin
    const scheduler = createScheduler({ clock: time, timers: time, logger: silentLogger() });
    const job = vi.fn(async () => {});
    scheduler.dailyAt('backup', '03:00', 'Europe/Berlin', job);

    await time.advance(59 * 60_000);
    expect(job).not.toHaveBeenCalled();
    await time.advance(61 * 60_000); // now 03:00 Berlin
    expect(job).toHaveBeenCalledTimes(1);
    await time.advance(24 * 60 * 60_000);
    expect(job).toHaveBeenCalledTimes(2);
    await scheduler.stop();
  });

  it('stops: clears timers and waits for running jobs', async () => {
    const time = createFakeTime();
    const scheduler = createScheduler({ clock: time, timers: time, logger: silentLogger() });
    let finished = false;
    let release: () => void = () => {};
    scheduler.every(
      'slow',
      1_000,
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            finished = true;
            resolve();
          };
        }),
    );
    await time.advance(0);

    const stopping = scheduler.stop();
    release();
    await stopping;
    expect(finished).toBe(true);
    expect(time.pendingCount()).toBe(0);
  });
});
