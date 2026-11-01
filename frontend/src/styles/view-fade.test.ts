import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexCss = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8');

// Covers: AC-56
describe('view fade', () => {
  it('uses the shared 600 ms view fade for the detail view', () => {
    expect(indexCss).toMatch(/\.view-enter\s*\{[^}]*view-in 600ms/);
    expect(indexCss).toMatch(/\.view-exit\s*\{[^}]*view-out 600ms/);
  });

  it('shortens the view fade to 150 ms under reduced motion', () => {
    const reduced = indexCss.slice(indexCss.indexOf('prefers-reduced-motion'));
    expect(reduced).toMatch(/\.view-enter,\s*\.view-exit\s*\{\s*animation-duration:\s*150ms/);
  });
});
