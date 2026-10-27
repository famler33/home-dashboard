import { describe, expect, it } from 'vitest';
import { sourceFixture } from '../test-fixtures';
import { deriveTileStatus, effectiveAgeSeconds, relativeAge } from './freshness';

const never = () => false;

// Covers: FR-5, FR-6, FR-7, AC-10, AC-11, AC-12
describe('effectiveAgeSeconds', () => {
  it('adds the monotonic time since receipt to the server age', () => {
    expect(effectiveAgeSeconds(sourceFixture({ ageSeconds: 30 }), 1_000, 61_000)).toBe(90);
  });

  it('is null when the source never loaded', () => {
    expect(effectiveAgeSeconds(sourceFixture({ ageSeconds: null }), 1_000, 2_000)).toBeNull();
  });

  it('never goes below the server age if the monotonic clock looks backwards', () => {
    expect(effectiveAgeSeconds(sourceFixture({ ageSeconds: 30 }), 5_000, 1_000)).toBe(30);
  });

  it('derives age from ageSeconds and the monotonic clock, not from Date.now', () => {
    const realNow = Date.now;
    Date.now = () => Date.parse('1999-01-01T00:00:00Z');
    try {
      expect(effectiveAgeSeconds(sourceFixture({ ageSeconds: 10 }), 0, 5_000)).toBe(15);
    } finally {
      Date.now = realNow;
    }
  });
});

describe('deriveTileStatus', () => {
  const base = { snapshotPresent: true, receivedAt: 0, nowMono: 0, isEmpty: never };

  it('is loading before the first snapshot', () => {
    expect(deriveTileStatus({ ...base, snapshotPresent: false, source: undefined })).toBe(
      'loading',
    );
  });

  it('is never-loaded when the bound source is missing from the snapshot', () => {
    expect(deriveTileStatus({ ...base, source: undefined })).toBe('never-loaded');
  });

  it.each([
    ['never-loaded', 'never-loaded'],
    ['error', 'error'],
  ] as const)('maps server status %s to %s', (serverStatus, expected) => {
    expect(
      deriveTileStatus({
        ...base,
        source: sourceFixture({ status: serverStatus, ageSeconds: null, data: null }),
      }),
    ).toBe(expected);
  });

  it('is fresh within the threshold', () => {
    expect(deriveTileStatus({ ...base, source: sourceFixture() })).toBe('fresh');
  });

  it('turns stale while offline when age plus elapsed exceeds the threshold', () => {
    const source = sourceFixture({ ageSeconds: 100, staleAfterSeconds: 120 });
    expect(deriveTileStatus({ ...base, source, nowMono: 19_000 })).toBe('fresh');
    expect(deriveTileStatus({ ...base, source, nowMono: 21_000 })).toBe('stale');
  });

  it('trusts the server status stale', () => {
    expect(
      deriveTileStatus({ ...base, source: sourceFixture({ status: 'stale', ageSeconds: 500 }) }),
    ).toBe('stale');
  });

  it('returns to fresh when the next snapshot is fresh', () => {
    const stale = sourceFixture({ status: 'stale', ageSeconds: 500 });
    const fresh = sourceFixture({ status: 'fresh', ageSeconds: 3 });
    expect(deriveTileStatus({ ...base, source: stale })).toBe('stale');
    expect(deriveTileStatus({ ...base, source: fresh })).toBe('fresh');
  });

  it('degrades fresh with null data to empty', () => {
    expect(deriveTileStatus({ ...base, source: sourceFixture({ data: null }) })).toBe('empty');
  });

  it('uses the tile-specific empty check', () => {
    const isEmpty = (data: unknown) => Array.isArray(data) && data.length === 0;
    expect(deriveTileStatus({ ...base, isEmpty, source: sourceFixture({ data: [] }) })).toBe(
      'empty',
    );
    expect(deriveTileStatus({ ...base, isEmpty, source: sourceFixture({ data: [1] }) })).toBe(
      'fresh',
    );
  });

  it('keeps stale ahead of empty so old content is labelled as old', () => {
    expect(
      deriveTileStatus({
        ...base,
        source: sourceFixture({ status: 'stale', data: null, ageSeconds: 999 }),
      }),
    ).toBe('stale');
  });
});

describe('relativeAge', () => {
  it.each([
    [0, { kind: 'justNow' }],
    [14, { kind: 'justNow' }],
    [45, { kind: 'relative', value: -45, unit: 'second' }],
    [300, { kind: 'relative', value: -5, unit: 'minute' }],
    [3 * 3600 + 120, { kind: 'relative', value: -3, unit: 'hour' }],
    [2 * 86400 + 5, { kind: 'relative', value: -2, unit: 'day' }],
  ])('describes %i seconds', (seconds, expected) => {
    expect(relativeAge(seconds)).toEqual(expected);
  });
});
