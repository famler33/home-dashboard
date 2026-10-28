import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tabletMediaQuery } from '../styles/tokens';
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

  it('requires a landscape screen of at least 1024 x 700 CSS pixels for the tablet layout', () => {
    expect(tabletMediaQuery).toContain('min-width: 1024px');
    expect(tabletMediaQuery).toContain('min-height: 700px');
    expect(tabletMediaQuery).toContain('orientation: landscape');
  });
});
