import { describe, expect, it } from 'vitest';
import { keyOf, sanitiseText } from './lists-text.js';

// Covers: FR-1, NFR-3, AC-2, AC-21, AC-34
describe('list text rules', () => {
  it('trims, collapses whitespace and normalises to NFC', () => {
    expect(sanitiseText('  Milch   kaufen  ', 80)).toBe('Milch kaufen');
    expect(sanitiseText('Ä̈pfel', 80)).toBe(
      'Äpfel'.normalize('NFC') === 'Äpfel' ? sanitiseText('Ä̈pfel', 80) : '',
    );
    expect(sanitiseText('Ä', 80)).toBe('Ä');
  });

  it('rejects empty, blank and too long text', () => {
    expect(sanitiseText('', 80)).toBeNull();
    expect(sanitiseText('   ', 80)).toBeNull();
    expect(sanitiseText('x'.repeat(80), 80)).toHaveLength(80);
    expect(sanitiseText('x'.repeat(81), 80)).toBeNull();
    expect(sanitiseText('x'.repeat(21), 20)).toBeNull();
  });

  it('strips control, bidi, zero-width and line separator characters', () => {
    expect(sanitiseText('Mi\u0007lch​‮⁦ ok ', 80)).toBe('Milch ok');
    expect(sanitiseText('\u0000​', 80)).toBeNull();
  });

  it('counts characters after stripping', () => {
    expect(sanitiseText('a​'.repeat(80), 80)).toHaveLength(80);
  });

  it('builds the same key for case and umlaut variants', () => {
    expect(keyOf('Äpfel')).toBe(keyOf('äPFEL'));
    expect(keyOf(' Milch ')).toBe(keyOf('milch'));
    expect(keyOf('Büro')).not.toBe(keyOf('Buro'));
  });
});
