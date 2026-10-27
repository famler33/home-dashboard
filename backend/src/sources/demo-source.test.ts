import { describe, expect, it } from 'vitest';
import { createDemoSource } from './demo-source.js';

// Covers: FR-6, AC-11, AC-22
describe('demo source', () => {
  it('declares a stale threshold of twice its interval', () => {
    const source = createDemoSource();
    expect(source.id).toBe('demo');
    expect(source.intervalSeconds).toBe(60);
    expect(source.staleAfterSeconds).toBe(source.intervalSeconds * 2);
  });

  it('returns a deterministic counter', async () => {
    const source = createDemoSource();
    const signal = new AbortController().signal;
    expect(await source.fetch(signal)).toEqual({ value: 1 });
    expect(await source.fetch(signal)).toEqual({ value: 2 });
  });
});
