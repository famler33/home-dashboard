import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot } from '../api/types';
import { snapshotFixture } from '../test-fixtures';
import { SnapshotProvider } from './SnapshotProvider';
import { useSnapshot } from './useSnapshot';

function Probe() {
  const { snapshot, offline } = useSnapshot();
  return (
    <output data-testid="probe">
      {JSON.stringify({
        offline,
        build: snapshot?.buildId ?? null,
        sources: snapshot?.sources.length ?? 0,
      })}
    </output>
  );
}

const state = () =>
  JSON.parse(screen.getByTestId('probe').textContent ?? '{}') as {
    offline: boolean;
    build: string | null;
    sources: number;
  };

type Fetcher = (signal: AbortSignal) => Promise<Snapshot>;

function mount(fetcher: Fetcher, props: Partial<Parameters<typeof SnapshotProvider>[0]> = {}) {
  const reload = vi.fn();
  render(
    <SnapshotProvider
      fetcher={fetcher}
      reload={reload}
      bundledBuildId="test-build"
      storage={null}
      {...props}
    >
      <Probe />
    </SnapshotProvider>,
  );
  return { reload };
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-10-28T10:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
});

// Covers: FR-11, FR-12, AC-13, AC-14, AC-15, AC-16
describe('SnapshotProvider', () => {
  it('loads the first snapshot immediately', async () => {
    const fetcher = vi.fn<Fetcher>(async () => snapshotFixture());
    mount(fetcher);
    await advance(0);
    expect(state()).toEqual({ offline: false, build: 'test-build', sources: 1 });
  });

  it('polls every pollMs', async () => {
    const fetcher = vi.fn<Fetcher>(async () => snapshotFixture());
    mount(fetcher, { pollMs: 30_000 });
    await advance(0);
    await advance(90_000);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('sets offline after two consecutive failed polls and keeps the last snapshot', async () => {
    const fetcher = vi.fn<Fetcher>();
    fetcher.mockResolvedValueOnce(snapshotFixture());
    fetcher.mockRejectedValue(new Error('network'));
    mount(fetcher, { pollMs: 30_000 });
    await advance(0);
    await advance(30_000);
    expect(state().offline).toBe(false);
    await advance(30_000);
    expect(state()).toEqual({ offline: true, build: 'test-build', sources: 1 });
  });

  it('treats a request over the timeout as a failure', async () => {
    const fetcher = vi.fn<Fetcher>(() => new Promise<Snapshot>(() => {}));
    mount(fetcher, { pollMs: 30_000, timeoutMs: 10_000 });
    await advance(41_000);
    expect(state().offline).toBe(true);
  });

  it('clears offline on the first successful poll', async () => {
    const fetcher = vi.fn<Fetcher>();
    fetcher.mockRejectedValueOnce(new Error('a'));
    fetcher.mockRejectedValueOnce(new Error('b'));
    fetcher.mockResolvedValue(snapshotFixture());
    mount(fetcher, { pollMs: 30_000 });
    await advance(30_000);
    expect(state().offline).toBe(true);
    await advance(30_000);
    expect(state()).toEqual({ offline: false, build: 'test-build', sources: 1 });
  });

  it('skips a tick while a request is still in flight', async () => {
    const fetcher = vi.fn<Fetcher>(() => new Promise<Snapshot>(() => {}));
    mount(fetcher, { pollMs: 1_000, timeoutMs: 60_000 });
    await advance(5_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps polling during a long outage and resumes without reload', async () => {
    const fetcher = vi.fn<Fetcher>();
    fetcher.mockResolvedValueOnce(snapshotFixture());
    for (let i = 0; i < 3; i += 1) fetcher.mockRejectedValueOnce(new Error('down'));
    fetcher.mockResolvedValue(snapshotFixture());
    const { reload } = mount(fetcher, { pollMs: 30_000 });
    await advance(0);
    await advance(90_000);
    expect(state().offline).toBe(true);
    await advance(30_000);
    expect(state().offline).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads when the snapshot buildId differs from the bundled id', async () => {
    const fetcher = vi.fn<Fetcher>(async () => snapshotFixture({ buildId: 'newer' }));
    const { reload } = mount(fetcher);
    await advance(0);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads when the bundled id is dev', async () => {
    const fetcher = vi.fn<Fetcher>(async () => snapshotFixture({ buildId: 'newer' }));
    const { reload } = mount(fetcher, { bundledBuildId: 'dev' });
    await advance(0);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload when the build ids match', async () => {
    const fetcher = vi.fn<Fetcher>(async () => snapshotFixture());
    const { reload } = mount(fetcher);
    await advance(0);
    await advance(60_000);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads once per day after dailyReloadAt in the configured timezone', async () => {
    vi.setSystemTime(Date.parse('2026-10-28T02:00:00Z')); // 03:00 Berlin
    const fetcher = vi.fn<Fetcher>(async () => snapshotFixture());
    const { reload } = mount(fetcher, { pollMs: 600_000 });
    await advance(0);
    expect(reload).not.toHaveBeenCalled();
    await advance(60 * 60_000); // 04:00 Berlin reached
    await advance(600_000);
    expect(reload).toHaveBeenCalledTimes(1);
    await advance(6 * 60 * 60_000);
    expect(reload).toHaveBeenCalledTimes(1);
    await advance(24 * 60 * 60_000);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('clears all intervals and listeners on unmount', async () => {
    const fetcher = vi.fn<Fetcher>(async () => snapshotFixture());
    const { unmount } = render(
      <SnapshotProvider
        fetcher={fetcher}
        reload={vi.fn()}
        bundledBuildId="test-build"
        storage={null}
      >
        <Probe />
      </SnapshotProvider>,
    );
    await advance(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
