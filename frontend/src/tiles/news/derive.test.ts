import { describe, expect, it } from 'vitest';
import { snapshotFixture } from '../../test-fixtures';
import { deriveNewsEntry } from './derive';
import { headline, newsEntry } from './test-data';

const fresh = (group: 'local' | 'global', age = 30) =>
  newsEntry(group, [headline('A')], { ageSeconds: age });
const stale = (group: 'local' | 'global', age = 3000) =>
  newsEntry(group, [headline('A')], { status: 'stale', ageSeconds: age });
const error = (group: 'local' | 'global') =>
  newsEntry(group, [], { status: 'error', data: null, ageSeconds: null, lastErrorCode: 'SOURCE_FETCH_FAILED' });
const never = (group: 'local' | 'global') =>
  newsEntry(group, [], { status: 'never-loaded', data: null, ageSeconds: null });

const derive = (...sources: ReturnType<typeof fresh>[]) =>
  deriveNewsEntry(snapshotFixture({ sources }));

// Covers: AD-7, AC-9, AC-17, AC-19, AC-20
describe('deriveNewsEntry', () => {
  it('returns nothing without news sources or a snapshot', () => {
    expect(deriveNewsEntry(null)).toBeUndefined();
    expect(derive()).toBeUndefined();
  });

  it('is fresh while any source is fresh, even if the other one is stale or failed', () => {
    expect(derive(fresh('local'), stale('global'))?.status).toBe('fresh');
    expect(derive(error('local'), fresh('global'))?.status).toBe('fresh');
  });

  it('is stale only when every source with data is stale, using the oldest age', () => {
    const entry = derive(stale('local', 3000), stale('global', 4000));
    expect(entry?.status).toBe('stale');
    expect(entry?.ageSeconds).toBe(4000);
    expect(derive(stale('local'), error('global'))?.status).toBe('stale');
  });

  it('is never-loaded when every source is never-loaded', () => {
    expect(derive(never('local'), never('global'))?.status).toBe('never-loaded');
  });

  it('is error when no source has data and one failed', () => {
    expect(derive(error('local'), never('global'))?.status).toBe('error');
    expect(derive(error('local'), error('global'))?.status).toBe('error');
  });

  it('works with a single news source', () => {
    expect(derive(fresh('global'))?.status).toBe('fresh');
  });
});
