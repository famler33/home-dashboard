import { expect, test } from '@playwright/test';
import { mockSnapshot, screenshotDir, smallestFontSize } from './helpers';

// Covers: FR-13, AC-17, AC-18, AC-19, AC-40
test.describe('day and night', () => {
  test('switches theme at the configured time using the fake clock', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-28T20:59:50Z') }); // 21:59:50 Berlin
    await mockSnapshot(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
    await page.clock.runFor(40_000);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
  });

  test('renders the same tiles in night theme as in day theme and keeps text readable', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-28T11:00:00Z') });
    await mockSnapshot(page);
    await page.goto('/');
    const day = await page.getByRole('heading', { level: 2 }).allInnerTexts();
    await page.clock.fastForward(11 * 60 * 60_000); // jump to 23:00 Berlin, timers fire once
    await page.clock.runFor(31_000);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');
    const night = await page.getByRole('heading', { level: 2 }).allInnerTexts();
    expect(night).toEqual(day);
    expect(await smallestFontSize(page)).toBeGreaterThanOrEqual(28);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${screenshotDir}/night.png` });
  });

  test('applies the drift as a transform on the shell wrapper', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-28T20:00:00Z') });
    await mockSnapshot(page);
    await page.goto('/');
    await page.clock.runFor(5 * 60_000 + 1_000);
    const style = await page.getByTestId('drift-wrapper').evaluate((node) => ({
      inline: (node as HTMLElement).style.transform,
      transition: (node as HTMLElement).style.transition,
    }));
    expect(style.inline).toMatch(/translate3d\(/);
    expect(style.transition).toContain('transform');
  });

  test('steps the drift without a transition under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date('2026-10-28T20:00:00Z') });
    await mockSnapshot(page);
    await page.goto('/');
    await page.clock.runFor(5 * 60_000 + 1_000);
    const transition = await page
      .getByTestId('drift-wrapper')
      .evaluate((node) => (node as HTMLElement).style.transition);
    expect(transition).toBe('none');
  });
});
