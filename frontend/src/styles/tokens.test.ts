import { describe, expect, it } from 'vitest';
import {
  colorTokens,
  contrastRatio,
  fontSizeAt,
  readablePairs,
  relativeLuminance,
  tabletTypeScale,
  themes,
  type TypeToken,
} from './tokens';

const tabletScreens = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1200 },
  { width: 2048, height: 1536 },
];

// Covers: FR-3, NFR-4, AC-2
describe('type scale tokens', () => {
  it('keeps every tablet type token at or above 28px at 1280, 1920 and 2048 px widths', () => {
    for (const token of Object.keys(tabletTypeScale) as TypeToken[]) {
      for (const { width, height } of tabletScreens) {
        expect(fontSizeAt(token, width, height), `${token} at ${width}`).toBeGreaterThanOrEqual(28);
      }
    }
  });

  it('grows with the screen above the floor', () => {
    expect(fontSizeAt('clock', 2048, 1536)).toBeGreaterThan(fontSizeAt('clock', 1280, 800));
  });

  it('keeps the clock at or above 112px and within 15% of the screen height', () => {
    for (const { width, height } of tabletScreens) {
      const size = fontSizeAt('clock', width, height);
      expect(size).toBeGreaterThanOrEqual(112);
      expect(size).toBeLessThanOrEqual(Math.max(112, height * 0.15));
    }
  });
});

// Covers: NFR-4, AC-2, AC-19
describe('color tokens', () => {
  it('defines the same tokens for day and night', () => {
    expect(Object.keys(themes.night).sort()).toEqual(Object.keys(themes.day).sort());
    expect(Object.keys(themes.day).sort()).toEqual([...colorTokens].sort());
  });

  it('keeps text/background contrast above the minimum in day and night themes', () => {
    for (const theme of ['day', 'night'] as const) {
      for (const pair of readablePairs) {
        const ratio = contrastRatio(themes[theme][pair.fg], themes[theme][pair.bg]);
        expect(ratio, `${theme}: ${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(pair.min);
      }
    }
  });

  it('uses lower luminance surface and ink tokens at night', () => {
    expect(relativeLuminance(themes.night.surface)).toBeLessThan(
      relativeLuminance(themes.day.surface),
    );
    expect(relativeLuminance(themes.night.ink)).toBeLessThan(
      relativeLuminance(themes.day['surface-raised']),
    );
    expect(relativeLuminance(themes.night['surface-raised'])).toBeLessThan(
      relativeLuminance(themes.day['surface-raised']),
    );
  });

  it('computes the WCAG contrast ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
