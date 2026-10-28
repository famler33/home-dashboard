import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tabletMediaQuery, tabletShortMediaQuery } from '../styles/tokens';
import { mockMatchMedia } from '../test-utils';
import { useLayoutMode } from './useLayoutMode';

// Covers: FR-14, AC-20, AC-37
describe('useLayoutMode', () => {
  it('uses the tablet layout when the tablet media query matches', () => {
    mockMatchMedia((query) => query === tabletMediaQuery);
    expect(renderHook(() => useLayoutMode()).result.current).toBe('tablet');
  });

  it('uses the phone layout otherwise', () => {
    mockMatchMedia(() => false);
    expect(renderHook(() => useLayoutMode()).result.current).toBe('phone');
  });

  it('requires a landscape screen of at least 1024 x 750 or 1180 x 700 CSS pixels for the tablet layout', () => {
    for (const clause of tabletMediaQuery.split(', ')) {
      expect(clause).toContain('orientation: landscape');
    }
    expect(tabletMediaQuery).toContain('(min-width: 1024px) and (min-height: 750px)');
    expect(tabletMediaQuery).toContain('(min-width: 1180px) and (min-height: 700px)');
  });

  it('applies the low-screen rule to every clause of the tablet query', () => {
    for (const clause of tabletShortMediaQuery.split(', ')) {
      expect(clause).toContain('(max-height: 850px)');
    }
    expect(tabletShortMediaQuery.split(', ')).toHaveLength(tabletMediaQuery.split(', ').length);
  });
});
