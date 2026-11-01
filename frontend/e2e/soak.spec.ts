import { expect, test } from '@playwright/test';
import { calendarSnapshotBody, calendarInstant } from './calendar-helpers';
import { demoSource, mockSnapshot, snapshotBody } from './helpers';
import { newsInstant, newsSnapshotBody } from './news-helpers';

// Covers: NFR-1, NFR-2, AC-8, AC-16
// Accelerated soak: virtual time runs through the poll, clock and animation timers.
// SOAK_MINUTES controls the virtual duration (default 10); on the real tablet the dashboard
// is simply left running and the heap is sampled by hand (see the runbook).
test('@soak keeps the JS heap flat with 30 s polling over a long virtual run', async ({
  page,
  context,
}) => {
  const minutes = Number(process.env['SOAK_MINUTES'] ?? 10);
  await page.clock.install({ time: new Date('2026-10-28T08:00:00Z') });
  await mockSnapshot(page, snapshotBody({ sources: [demoSource()] }));
  await page.goto('/');

  const session = await context.newCDPSession(page);
  await session.send('Performance.enable');
  const heap = async (): Promise<number> => {
    await session.send('HeapProfiler.collectGarbage');
    const { metrics } = await session.send('Performance.getMetrics');
    return metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0;
  };

  for (let i = 0; i < 4; i += 1) await page.clock.runFor(30_000);
  const baseline = await heap();

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (let elapsed = 0; elapsed < minutes * 60_000; elapsed += 30_000)
    await page.clock.runFor(30_000);

  const end = await heap();
  expect(errors).toEqual([]);
  expect(end).toBeLessThanOrEqual(baseline * 1.25);
});

// Covers: NFR-1
test('@soak keeps the JS heap flat with the calendar tile while tabs are switched', async ({
  page,
  context,
}) => {
  const minutes = Number(process.env['SOAK_MINUTES'] ?? 10);
  await page.clock.install({ time: calendarInstant });
  await page.route('**/api/v1/snapshot', (route) =>
    route.fulfill({ json: calendarSnapshotBody() }),
  );
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Alex' })).toBeVisible();

  const session = await context.newCDPSession(page);
  await session.send('Performance.enable');
  const heap = async (): Promise<number> => {
    await session.send('HeapProfiler.collectGarbage');
    const { metrics } = await session.send('Performance.getMetrics');
    return metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0;
  };
  const names = ['Familie', 'Alex', 'Alle'];

  for (let i = 0; i < 4; i += 1) await page.clock.runFor(30_000);
  const baseline = await heap();

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let turn = 0;
  for (let elapsed = 0; elapsed < minutes * 60_000; elapsed += 30_000) {
    await page.getByRole('tab', { name: names[turn % names.length]! }).click();
    turn += 1;
    await page.clock.runFor(30_000);
  }

  const end = await heap();
  expect(errors).toEqual([]);
  expect(end).toBeLessThanOrEqual(baseline * 1.25);
});

// Covers: NFR-1
test('@soak keeps the JS heap flat with the news tile rotating and being switched by hand', async ({
  page,
  context,
}) => {
  const minutes = Number(process.env['SOAK_MINUTES'] ?? 10);
  await page.clock.install({ time: newsInstant });
  await page.route('**/api/v1/snapshot', (route) => route.fulfill({ json: newsSnapshotBody() }));
  await page.goto('/');
  await expect(page.getByTestId('view-surface')).toBeVisible();

  const session = await context.newCDPSession(page);
  await session.send('Performance.enable');
  const heap = async (): Promise<number> => {
    await session.send('HeapProfiler.collectGarbage');
    const { metrics } = await session.send('Performance.getMetrics');
    return metrics.find((metric) => metric.name === 'JSHeapUsedSize')?.value ?? 0;
  };

  for (let i = 0; i < 4; i += 1) await page.clock.runFor(30_000);
  const baseline = await heap();

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (let elapsed = 0; elapsed < minutes * 60_000; elapsed += 30_000) {
    await page.getByTestId('view-surface').click();
    await page.clock.runFor(30_000);
  }

  const end = await heap();
  expect(errors).toEqual([]);
  expect(end).toBeLessThanOrEqual(baseline * 1.25);
});
