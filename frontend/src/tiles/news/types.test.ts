import { describe, expect, it } from 'vitest';
import { headline, newsEntry } from './test-data';
import { isNewsPayload } from './types';

// Covers: FR-2 (F-1)
describe('isNewsPayload', () => {
  it('accepts a payload from the backend', () => {
    expect(isNewsPayload(newsEntry('local', [headline('A')]).data)).toBe(true);
  });

  it('rejects other shapes', () => {
    expect(isNewsPayload(null)).toBe(false);
    expect(isNewsPayload({})).toBe(false);
    expect(isNewsPayload({ group: 'local', sourceName: 'x', headlines: [{ id: 1 }] })).toBe(false);
    expect(isNewsPayload({ group: 'sport', sourceName: 'x', headlines: [] })).toBe(false);
  });
});
