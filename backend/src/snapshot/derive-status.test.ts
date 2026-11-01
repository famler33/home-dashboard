import { describe, expect, it } from 'vitest';
import type { SourceState } from '../cache/snapshot-store.js';
import { deriveStatus } from './derive-status.js';

const base: SourceState = {
  sourceId: 'demo',
  payload: { value: 1 },
  lastSuccessAt: 1_000_000,
  lastAttemptAt: 1_000_000,
  lastErrorCode: null,
  consecutiveFailures: 0,
};

// Covers: FR-6, AC-11
describe('deriveStatus', () => {
  it('is never-loaded without a state row', () => {
    expect(deriveStatus(undefined, 120, 2_000_000)).toBe('never-loaded');
  });

  it('is never-loaded without success and without any attempt', () => {
    const state = { ...base, payload: null, lastSuccessAt: null, lastAttemptAt: null };
    expect(deriveStatus(state, 120, 2_000_000)).toBe('never-loaded');
  });

  it('is error when the first fetch failed and no payload exists', () => {
    const state: SourceState = {
      ...base,
      payload: null,
      lastSuccessAt: null,
      lastErrorCode: 'SOURCE_FETCH_FAILED',
      consecutiveFailures: 1,
    };
    expect(deriveStatus(state, 120, 2_000_000)).toBe('error');
  });

  it('marks a source stale only after staleAfterSeconds', () => {
    expect(deriveStatus(base, 120, 1_000_000 + 120_000)).toBe('fresh');
    expect(deriveStatus(base, 120, 1_000_000 + 120_001)).toBe('stale');
  });

  it('stays fresh within the threshold even if the last attempt failed', () => {
    const state: SourceState = { ...base, lastErrorCode: 'SOURCE_TIMEOUT', consecutiveFailures: 1 };
    expect(deriveStatus(state, 120, 1_000_000 + 30_000)).toBe('fresh');
  });
});
