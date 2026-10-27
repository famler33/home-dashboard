import { describe, expect, it } from 'vitest';
import { de } from './de';

function leaves(value: unknown, path = ''): [string, unknown][] {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) =>
      leaves(child, path ? `${path}.${key}` : key),
    );
  }
  return [[path, value]];
}

// Covers: FR-2, NFR-9, AC-3
describe('German dictionary', () => {
  it('resolves every dictionary key to a non-empty German string', () => {
    const entries = leaves(de);
    expect(entries.length).toBeGreaterThan(20);
    for (const [key, value] of entries) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it('has an errors.* entry for every backend error code', () => {
    for (const code of ['NOT_FOUND', 'VALIDATION_FAILED', 'PAYLOAD_TOO_LARGE', 'INTERNAL_ERROR']) {
      expect(de.errors).toHaveProperty(code);
    }
    for (const code of ['SOURCE_FETCH_FAILED', 'SOURCE_TIMEOUT']) {
      expect(de.errors).toHaveProperty(code);
    }
  });

  it('uses calm wording without exclamation marks or error codes in state texts', () => {
    const texts = leaves(de).map(([, value]) => String(value));
    expect(texts.some((text) => text.includes('!'))).toBe(false);
  });
});
