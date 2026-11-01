import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { de } from '../../i18n/de';
import { contrastRatio, themes } from '../../styles/tokens';

// Covers: FR-11, NFR-7, AC-18, AC-24
describe('news texts and colours', () => {
  it('has the German texts of the PRD under news.*', () => {
    expect(de.news.states.neverLoaded.title).toBe('Schlagzeilen noch nicht geladen');
    expect(de.news.states.error.title).toBe('Schlagzeilen derzeit nicht verfügbar');
    expect(de.news.empty).toBe('Noch keine Schlagzeilen');
    for (const key of ['regional', 'world', 'position', 'previous', 'next', 'stale'] as const) {
      expect(de.news[key].trim().length, key).toBeGreaterThan(0);
    }
  });

  it('contains no hard-coded visible text in the news components', () => {
    const folder = join(process.cwd(), 'src/tiles/news');
    const files = readdirSync(folder).filter(
      (name) => name.endsWith('.tsx') && !name.includes('.test.'),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(join(folder, file), 'utf8');
      // JSX text nodes with letters, e.g. `>Regional<`; expressions in braces are fine.
      expect(source.match(/(?<!=)>\s*[A-Za-zÄÖÜäöüß][^<>{}]*</g) ?? [], file).toEqual([]);
    }
  });

  it('keeps the colour pairs of the news tile above the contrast floors in day and night', () => {
    for (const theme of ['day', 'night'] as const) {
      const palette = themes[theme];
      const surface = palette['surface-raised'];
      expect(contrastRatio(palette['ink'], surface), `${theme}: ink`).toBeGreaterThanOrEqual(7);
      expect(
        contrastRatio(palette['ink-muted'], surface),
        `${theme}: ink-muted`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette['warn'], surface), `${theme}: warn`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
