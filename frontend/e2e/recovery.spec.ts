import { expect, test } from '@playwright/test';
import { demoSource, mockSnapshot, snapshotBody } from './helpers';

// Covers: FR-11, FR-12, AC-13, AC-14, AC-15, AC-16
test.describe('recovery', () => {
  test('shows and hides the offline indicator as the snapshot route fails and recovers', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-28T10:15:00Z') });
    let fail = false;
    await page.route('**/api/v1/snapshot', (route) =>
      fail ? route.abort() : route.fulfill({ json: snapshotBody({ sources: [demoSource()] }) }),
    );
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations += 1;
    });
    await page.goto('/');
    await expect(page.getByRole('status')).toHaveCount(0);

    fail = true;
    await page.clock.runFor(30_000);
    await page.clock.runFor(30_000);
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Demo' })).toContainText('42');

    fail = false;
    await page.clock.runFor(30_000);
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(navigations).toBe(1);
  });

  test('keeps polling during a long outage and resumes without reload', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-28T10:15:00Z') });
    let fail = false;
    await page.route('**/api/v1/snapshot', (route) =>
      fail ? route.abort() : route.fulfill({ json: snapshotBody({ sources: [demoSource()] }) }),
    );
    await page.goto('/');
    fail = true;
    for (let i = 0; i < 5; i += 1) await page.clock.runFor(30_000);
    await expect(page.getByRole('status')).toBeVisible();
    fail = false;
    await page.clock.runFor(30_000);
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Demo' })).toHaveAttribute(
      'data-status',
      /fresh|stale/,
    );
  });

  test('navigates when the mocked snapshot returns a new buildId', async ({ page }) => {
    let documents = 0;
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documents += 1;
    });
    await mockSnapshot(page, snapshotBody({ buildId: 'a-newer-build' }));
    await page.goto('/');
    await expect.poll(() => documents, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  });

  test('does not reload while the build ids match', async ({ page }) => {
    let documents = 0;
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documents += 1;
    });
    await mockSnapshot(page, snapshotBody({ buildId: 'e2e' }));
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(documents).toBe(1);
  });
});
