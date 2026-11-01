import { describe, expect, it } from 'vitest';
import type { SourceSnapshot } from '../../api/types';
import { snapshotFixture, sourceFixture } from '../../test-fixtures';
import { deriveCalendarEntry } from './derive';

const entry = (id: string, extra: Partial<SourceSnapshot> = {}): SourceSnapshot =>
  sourceFixture({
    id,
    status: 'fresh',
    data: { events: [], truncated: false },
    ageSeconds: 30,
    staleAfterSeconds: 1800,
    ...extra,
  });
const snapshotOf = (...entries: SourceSnapshot[]) => snapshotFixture({ sources: entries });
const failed = { status: 'error', data: null, ageSeconds: null, lastUpdated: null } as const;
const never = { status: 'never-loaded', data: null, ageSeconds: null, lastUpdated: null } as const;

// Covers: FR-8, AC-31, AC-32, AC-33, AC-34
describe('deriveCalendarEntry', () => {
  it('is undefined without any calendar source', () => {
    expect(deriveCalendarEntry(snapshotOf(sourceFixture()))).toBeUndefined();
    expect(deriveCalendarEntry(null)).toBeUndefined();
  });

  it('is fresh when at least one calendar is fresh, even if others are stale or failed', () => {
    const derived = deriveCalendarEntry(
      snapshotOf(
        entry('calendar-family'),
        entry('calendar-person-1', { status: 'stale', ageSeconds: 4000 }),
        entry('calendar-person-2', failed),
      ),
    );
    expect(derived?.status).toBe('fresh');
    expect(derived?.ageSeconds).toBe(30);
  });

  it('is stale with the oldest age when every calendar with data is stale', () => {
    const derived = deriveCalendarEntry(
      snapshotOf(
        entry('calendar-family', { status: 'stale', ageSeconds: 2000 }),
        entry('calendar-person-1', { status: 'stale', ageSeconds: 5000 }),
        entry('calendar-person-2', failed),
      ),
    );
    expect(derived?.status).toBe('stale');
    expect(derived?.ageSeconds).toBe(5000);
  });

  it('is error when no calendar has data and one failed', () => {
    const derived = deriveCalendarEntry(
      snapshotOf(entry('calendar-family', failed), entry('calendar-person-1', never)),
    );
    expect(derived?.status).toBe('error');
  });

  it('is never-loaded when no calendar has data and none failed', () => {
    const derived = deriveCalendarEntry(
      snapshotOf(entry('calendar-family', never), entry('calendar-person-1', never)),
    );
    expect(derived?.status).toBe('never-loaded');
  });

  it('works with a single enabled calendar', () => {
    expect(deriveCalendarEntry(snapshotOf(entry('calendar-family')))?.status).toBe('fresh');
    expect(deriveCalendarEntry(snapshotOf(entry('calendar-family', failed)))?.status).toBe('error');
  });

  it('carries a non-empty payload so the tile frame never reports empty', () => {
    expect(deriveCalendarEntry(snapshotOf(entry('calendar-family')))?.data).not.toBeNull();
  });
});
