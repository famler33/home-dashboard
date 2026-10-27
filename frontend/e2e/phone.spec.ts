import { expect, test } from '@playwright/test';
import { mockSnapshot, screenshotDir } from './helpers';

// Covers: FR-14, NFR-4, AC-20, AC-21
for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
]) {
  test.describe(`phone ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, hasTouch: true });

    test('has no horizontal scrolling', async ({ page }) => {
      await mockSnapshot(page);
      await page.goto('/');
      await expect(page.getByRole('region')).toHaveCount(4);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({
        path: `${screenshotDir}/phone-${viewport.width}.png`,
        fullPage: true,
      });
    });

    test('shows the lists tile first', async ({ page }) => {
      await mockSnapshot(page);
      await page.goto('/');
      const first = await page.getByRole('heading', { level: 2 }).first().innerText();
      expect(first.toLowerCase()).toContain('einkaufsliste');
    });

    test('keeps every interactive element at least 44px', async ({ page }) => {
      await mockSnapshot(page);
      await page.goto('/');
      const sizes = await page
        .locator('button, a[href], input, select, textarea, [role="button"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const r = node.getBoundingClientRect();
            return Math.min(r.width, r.height);
          }),
        );
      for (const size of sizes) expect(size).toBeGreaterThanOrEqual(44);
    });

    test('does not show the fullscreen hint on the phone', async ({ page }) => {
      await mockSnapshot(page);
      await page.goto('/');
      await expect(page.getByRole('note')).toHaveCount(0);
    });
  });
}
