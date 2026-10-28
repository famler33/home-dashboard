import { describe, expect, it } from 'vitest';
import { dedupe, mergeCalendars } from './merge';
import { settingsFixture, tag, timed } from './test-data';
import type { SourceSnapshot } from '../../api/types';

const entry = (id: string, events: ReturnType<typeof timed>[]): SourceSnapshot => ({
  id,
  status: 'fresh',
  data: { events, truncated: false },
  lastUpdated: '2026-10-28T10:00:00.000Z',
  ageSeconds: 30,
  staleAfterSeconds: 1800,
  lastErrorCode: null,
});

// Covers: FR-1, FR-3, AC-1, AC-13, AC-14
describe('mergeCalendars', () => {
  it('merges the events of all three calendars into one list with calendar tags', () => {
    const merged = mergeCalendars(
      [
        entry('calendar-family', [timed('A', '2026-10-28T12:00', '2026-10-28T13:00')]),
        entry('calendar-person-1', [timed('B', '2026-10-28T14:00', '2026-10-28T15:00')]),
        entry('calendar-person-2', [timed('C', '2026-10-28T16:00', '2026-10-28T17:00')]),
      ],
      settingsFixture,
    );
    expect(merged.map((event) => [event.title, event.calendar, event.role, event.color])).toEqual([
      ['A', 'family', 'family', 'blue'],
      ['B', 'person-1', 'person', 'green'],
      ['C', 'person-2', 'person', 'orange'],
    ]);
    expect(merged[0]?.calendarName).toBe('Familie');
  });

  it('skips sources without payload, unknown sources and disabled calendars', () => {
    const never: SourceSnapshot = {
      ...entry('calendar-person-1', []),
      status: 'never-loaded',
      data: null,
    };
    const merged = mergeCalendars(
      [
        never,
        entry('calendar-other', [timed('X', '2026-10-28T12:00', '2026-10-28T13:00')]),
        entry('calendar-person-2', [timed('C', '2026-10-28T16:00', '2026-10-28T17:00')]),
      ],
      {
        ...settingsFixture,
        calendars: settingsFixture.calendars.filter((c) => c.id !== 'person-2'),
      },
    );
    expect(merged).toEqual([]);
  });
});

describe('dedupe', () => {
  it('merges events with the same uid and start, keeping the family copy', () => {
    const shared = timed('Elternabend', '2026-10-29T17:00', '2026-10-29T18:00');
    const result = dedupe([tag(shared, 'person-1'), tag(shared, 'family')]);
    expect(result).toHaveLength(1);
    expect(result[0]?.calendar).toBe('family');
  });

  it('merges events with the same title, start and end even with different uids', () => {
    const a = timed('Arzt', '2026-10-29T08:00', '2026-10-29T09:00', { uid: 'a' });
    const b = timed('  arzt ', '2026-10-29T08:00', '2026-10-29T09:00', { uid: 'b' });
    expect(dedupe([tag(a, 'person-1'), tag(b, 'person-2')])).toHaveLength(1);
  });

  it('keeps two different appointments with the same title at different times', () => {
    const a = timed('Arzt', '2026-10-29T08:00', '2026-10-29T09:00', { uid: 'a' });
    const b = timed('Arzt', '2026-10-29T10:00', '2026-10-29T11:00', { uid: 'b' });
    expect(dedupe([tag(a), tag(b)])).toHaveLength(2);
  });

  it('keeps the first calendar in order when no family copy exists', () => {
    const shared = timed('Call', '2026-10-29T08:00', '2026-10-29T09:00');
    const result = dedupe([tag(shared, 'person-2'), tag(shared, 'person-1')]);
    expect(result[0]?.calendar).toBe('person-1');
  });
});
