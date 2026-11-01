import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Covers: FR-16, AC-38
describe('web app manifest', () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'public/manifest.webmanifest'), 'utf8'),
  ) as Record<string, unknown>;

  it('ships a manifest with display fullscreen and a German language', () => {
    expect(manifest['display']).toBe('fullscreen');
    expect(manifest['lang']).toBe('de');
    expect(manifest['name']).toBe('Home-Dashboard');
    expect(manifest['orientation']).toBe('landscape');
  });

  it('is linked from the HTML entry together with the Apple web app tags', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('lang="de"');
  });
});
