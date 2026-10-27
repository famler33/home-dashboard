import { expect, test, type Page } from '@playwright/test';
import { mockSnapshot } from './helpers';

interface TileAnimation {
  name: string;
  delay: number;
  duration: number;
}

async function tileAnimations(page: Page): Promise<TileAnimation[]> {
  return page.getByRole('region').evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      const toMs = (value: string) => Number.parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
      return {
        name: style.animationName,
        delay: toMs(style.animationDelay),
        duration: toMs(style.animationDuration),
      };
    }),
  );
}

async function keyframeProperties(page: Page, name: string): Promise<string[]> {
  return page.evaluate((keyframeName) => {
    const props = new Set<string>();
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        const scan = (r: CSSRule) => {
          if (r instanceof CSSKeyframesRule && r.name === keyframeName) {
            for (const frame of Array.from(r.cssRules) as CSSKeyframeRule[]) {
              for (let i = 0; i < frame.style.length; i += 1) props.add(frame.style[i]!);
            }
          }
          if ('cssRules' in r)
            for (const child of Array.from((r as CSSGroupingRule).cssRules)) scan(child);
        };
        scan(rule);
      }
    }
    return [...props];
  }, name);
}

// Covers: F-2, FR-15, AC-5, AC-6, AC-7
test.describe('motion', () => {
  test('animates tiles in with increasing delay using only transform and opacity', async ({
    page,
  }) => {
    await mockSnapshot(page);
    await page.goto('/');
    const animations = await tileAnimations(page);
    expect(animations).toHaveLength(4);
    for (const animation of animations) expect(animation.name).toBe('tile-in');
    const delays = animations.map((animation) => animation.delay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(new Set(delays).size).toBe(delays.length);
    expect((await keyframeProperties(page, 'tile-in')).sort()).toEqual(['opacity', 'transform']);
    expect((await keyframeProperties(page, 'ambient')).sort()).toEqual(['transform']);
  });

  test('shows a digit transition when the minute changes', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-28T14:04:50Z') });
    await mockSnapshot(page);
    await page.goto('/');
    const digits = page.locator('time > span[aria-hidden="true"]');
    await expect(page.locator('time')).toHaveAttribute('aria-label', 'Es ist 15:04 Uhr');
    await page.clock.runFor(15_000);
    await expect(page.locator('time')).toHaveAttribute('aria-label', 'Es ist 15:05 Uhr');
    const transforms = await page.locator('time span[style*="transform"]').count();
    expect(transforms).toBeGreaterThan(0);
    await page.clock.runFor(3_000);
    await expect(digits).toHaveCount(5); // four digits and the colon, the leaving digit is gone
  });

  test('uses opacity-only animations and no ambient loop with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockSnapshot(page);
    await page.goto('/');
    const animations = await tileAnimations(page);
    for (const animation of animations) {
      expect(animation.name).toBe('tile-fade');
      expect(animation.duration).toBeLessThanOrEqual(150);
      expect(animation.delay).toBe(0);
    }
    const ambient = await page
      .locator('.animate-ambient')
      .first()
      .evaluate((node) => getComputedStyle(node).animationName);
    expect(ambient).toBe('none');
    expect(await keyframeProperties(page, 'tile-fade')).toEqual(['opacity']);
  });
});
