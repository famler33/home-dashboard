import { describe, expect, it } from 'vitest';
import { buildHeadlines } from './headlines';
import { headline, newsEntry } from './test-data';

// Covers: FR-3, AC-1, AC-2, AC-17, AC-19, AC-25
describe('buildHeadlines', () => {
  it('puts all local headlines before the global ones, keeping feed order', () => {
    const result = buildHeadlines([
      { entry: newsEntry('global', [headline('G1'), headline('G2')]), ageSeconds: 30 },
      { entry: newsEntry('local', [headline('L1'), headline('L2')]), ageSeconds: 30 },
    ]);
    expect(result.map((h) => h.title)).toEqual(['L1', 'L2', 'G1', 'G2']);
  });

  it('tags every headline with group and source name', () => {
    const [first] = buildHeadlines([
      { entry: newsEntry('local', [headline('L1')]), ageSeconds: 30 },
    ]);
    expect(first).toMatchObject({ group: 'local', sourceName: 'rbb24', stale: false });
  });

  it('marks headlines of a stale source with the age of that source only', () => {
    const result = buildHeadlines([
      {
        entry: newsEntry('local', [headline('L1')], { status: 'stale' }),
        ageSeconds: 3000,
      },
      { entry: newsEntry('global', [headline('G1')]), ageSeconds: 30 },
    ]);
    expect(result[0]).toMatchObject({ stale: true, sourceAgeSeconds: 3000 });
    expect(result[1]).toMatchObject({ stale: false, sourceAgeSeconds: null });
  });

  it('treats a source older than its threshold as stale even if the server said fresh', () => {
    const [first] = buildHeadlines([
      { entry: newsEntry('local', [headline('L1')]), ageSeconds: 2800 },
    ]);
    expect(first?.stale).toBe(true);
  });

  it('skips sources without a usable payload', () => {
    const result = buildHeadlines([
      {
        entry: newsEntry('local', [], { status: 'error', data: null, ageSeconds: null }),
        ageSeconds: null,
      },
      { entry: newsEntry('global', [headline('G1')]), ageSeconds: 30 },
    ]);
    expect(result.map((h) => h.title)).toEqual(['G1']);
  });
});
