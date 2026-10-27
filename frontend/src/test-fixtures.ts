import type { Snapshot, SourceSnapshot } from './api/types';

export function sourceFixture(overrides: Partial<SourceSnapshot> = {}): SourceSnapshot {
  return {
    id: 'demo',
    status: 'fresh',
    data: { value: 42 },
    lastUpdated: '2026-10-28T10:14:30.000Z',
    ageSeconds: 30,
    staleAfterSeconds: 120,
    lastErrorCode: null,
    ...overrides,
  };
}

export function snapshotFixture(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    buildId: 'test-build',
    serverTime: '2026-10-28T10:15:00.000Z',
    settings: {
      timezone: 'Europe/Berlin',
      display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
    },
    sources: [sourceFixture()],
    ...overrides,
  };
}
