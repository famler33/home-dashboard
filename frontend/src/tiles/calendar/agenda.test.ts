import { describe, expect, it } from 'vitest';
import { applyTab, buildDays, dayKind, splitKita, visibleEvents } from './agenda';
import { allDay, calendarNow, settingsFixture, tag, timed, tz } from './test-data';

const now = calendarNow; // 2026-10-28 11:00 Berlin
const days = (events: ReturnType<typeof tag>[]) =>
  buildDays(visibleEvents(events, now, tz), now, tz);
const titles = (group: { items: { event: { title: string } }[] } | undefined) =>
  group?.items.map((item) => item.event.title) ?? [];

// Covers: FR-1, FR-2, AC-1, AC-2, AC-3, AC-7, AC-8, AC-11, AC-18, AC-22, AC-24, AC-25, AC-27
describe('visibleEvents', () => {
  it('hides a timed event once its end has passed', () => {
    const events = [
      tag(timed('Vorbei', '2026-10-28T08:00', '2026-10-28T09:00')),
      tag(timed('Gerade vorbei', '2026-10-28T09:00', '2026-10-28T10:00')),
      tag(timed('Später', '2026-10-28T12:00', '2026-10-28T13:00')),
    ];
    expect(visibleEvents(events, now, tz).map((event) => event.title)).toEqual(['Später']);
  });

  it('keeps a running event and an all-day event', () => {
    const events = [
      tag(timed('Läuft', '2026-10-28T09:30', '2026-10-28T10:30')),
      tag(allDay('Ganzer Tag', '2026-10-28', '2026-10-29')),
    ];
    expect(visibleEvents(events, now, tz)).toHaveLength(2);
  });

  it('hides an all-day event whose last day was yesterday', () => {
    const events = [tag(allDay('Gestern', '2026-10-27', '2026-10-28'))];
    expect(visibleEvents(events, now, tz)).toEqual([]);
  });

  it('uses the given now, not the device clock', () => {
    const later = Date.parse('2026-10-28T13:00:00Z');
    const events = [tag(timed('Mittags', '2026-10-28T11:00', '2026-10-28T12:00'))];
    expect(visibleEvents(events, now, tz)).toHaveLength(1);
    expect(visibleEvents(events, later, tz)).toHaveLength(0);
  });
});

describe('buildDays', () => {
  it('groups events into today, tomorrow and the next two days', () => {
    const result = days([
      tag(timed('Heute', '2026-10-28T14:00', '2026-10-28T15:00')),
      tag(timed('Morgen', '2026-10-29T08:00', '2026-10-29T09:00')),
      tag(timed('Freitag', '2026-10-30T08:00', '2026-10-30T09:00')),
      tag(timed('Samstag', '2026-10-31T08:00', '2026-10-31T09:00')),
    ]);
    expect(result.map((group) => [group.date, group.kind])).toEqual([
      ['2026-10-28', 'today'],
      ['2026-10-29', 'tomorrow'],
      ['2026-10-30', 'date'],
      ['2026-10-31', 'date'],
    ]);
  });

  it('ignores events after the fourth day and before today', () => {
    const result = days([
      tag(timed('Zu spät', '2026-11-01T08:00', '2026-11-01T09:00')),
      tag(timed('Gestern', '2026-10-27T08:00', '2026-10-27T09:00')),
    ]);
    expect(result.flatMap((group) => titles(group))).toEqual([]);
  });

  it('omits days without events but always keeps today', () => {
    const result = days([tag(timed('Samstag', '2026-10-31T08:00', '2026-10-31T09:00'))]);
    expect(result.map((group) => group.date)).toEqual(['2026-10-28', '2026-10-31']);
    expect(result[0]?.items).toEqual([]);
  });

  it('keeps today with no items after all of today ended', () => {
    const result = days([tag(timed('Vorbei', '2026-10-28T07:00', '2026-10-28T08:00'))]);
    expect(result).toHaveLength(1);
    expect(result[0]?.items).toEqual([]);
  });

  it('puts all-day events first and sorts the rest by start time then title', () => {
    const result = days([
      tag(timed('B spät', '2026-10-28T15:00', '2026-10-28T16:00')),
      tag(timed('A früh', '2026-10-28T12:00', '2026-10-28T13:00')),
      tag(allDay('Ganztags', '2026-10-28', '2026-10-29')),
      tag(timed('A gleich', '2026-10-28T15:00', '2026-10-28T16:00')),
    ]);
    expect(titles(result[0])).toEqual(['Ganztags', 'A früh', 'A gleich', 'B spät']);
  });

  it('lists a family event before a work event with the same start', () => {
    const result = days([
      tag(timed('Arbeit', '2026-10-28T12:00', '2026-10-28T13:00'), 'person-1'),
      tag(timed('Familie', '2026-10-28T12:00', '2026-10-28T13:00'), 'family'),
    ]);
    expect(titles(result[0])).toEqual(['Familie', 'Arbeit']);
  });

  it('shows a three-day all-day event on each day with its part', () => {
    const result = days([tag(allDay('Urlaub', '2026-10-28', '2026-10-31'))]);
    expect(result.map((group) => group.items[0]?.part)).toEqual([
      { index: 1, total: 3 },
      { index: 2, total: 3 },
      { index: 3, total: 3 },
    ]);
  });

  it('shows an event from 22:00 to 02:00 on both days and not on a third', () => {
    const result = days([tag(timed('Spät', '2026-10-28T21:00', '2026-10-29T01:00'))]);
    expect(result.filter((group) => group.items.length > 0).map((group) => group.date)).toEqual([
      '2026-10-28',
      '2026-10-29',
    ]);
  });

  it('does not cover the next day when an event ends exactly at midnight', () => {
    const result = days([tag(timed('Bis Mitternacht', '2026-10-28T21:00', '2026-10-28T23:00'))]);
    expect(result.flatMap((group) => titles(group))).toEqual(['Bis Mitternacht']);
    expect(result.some((group) => group.date === '2026-10-29')).toBe(false);
  });

  it('shows an event that started yesterday and runs into today', () => {
    const result = days([tag(timed('Nachtschicht', '2026-10-27T22:00', '2026-10-28T12:00'))]);
    expect(titles(result[0])).toEqual(['Nachtschicht']);
    expect(result[0]?.items[0]?.part).toEqual({ index: 2, total: 2 });
  });

  it('formats days in the settings time zone, not the device zone', () => {
    // 23:30 UTC on the 28th is already the 29th in Berlin
    const result = days([tag(timed('Nach Mitternacht', '2026-10-28T23:30', '2026-10-29T00:30'))]);
    expect(result.find((group) => group.items.length > 0)?.date).toBe('2026-10-29');
  });
});

describe('dayKind', () => {
  it('names today and tomorrow', () => {
    expect(dayKind('2026-10-28', '2026-10-28')).toBe('today');
    expect(dayKind('2026-10-29', '2026-10-28')).toBe('tomorrow');
    expect(dayKind('2026-10-30', '2026-10-28')).toBe('date');
  });
});

describe('applyTab', () => {
  const events = [
    tag(timed('Fam', '2026-10-28T12:00', '2026-10-28T13:00'), 'family'),
    tag(timed('Alex', '2026-10-28T12:00', '2026-10-28T13:00'), 'person-1'),
    tag(timed('Ben', '2026-10-28T12:00', '2026-10-28T13:00'), 'person-2'),
  ];
  it('shows only the selected calendar', () => {
    expect(applyTab(events, 'all')).toHaveLength(3);
    expect(applyTab(events, 'family').map((event) => event.title)).toEqual(['Fam']);
    expect(applyTab(events, 'person-1').map((event) => event.title)).toEqual(['Alex']);
  });

  it('applies the ended, multi-day and omit-empty rules in every tab', () => {
    const tabbed = [
      tag(timed('Vorbei', '2026-10-28T07:00', '2026-10-28T08:00'), 'person-1'),
      tag(allDay('Urlaub', '2026-10-30', '2026-11-01'), 'person-1'),
    ];
    const result = buildDays(visibleEvents(applyTab(tabbed, 'person-1'), now, tz), now, tz);
    expect(result.map((group) => group.date)).toEqual(['2026-10-28', '2026-10-30', '2026-10-31']);
    expect(result[0]?.items).toEqual([]);
  });
});

describe('splitKita', () => {
  const kitaEvents = [
    tag(timed('Kita holen – Alex', '2026-10-28T14:30', '2026-10-28T15:00')),
    tag(timed('KITA bringen', '2026-10-29T07:00', '2026-10-29T07:30')),
    tag(timed('Kita Elternabend', '2026-10-30T16:00', '2026-10-30T17:00')),
    tag(timed('Kita-Fest', '2026-10-28T13:00', '2026-10-28T14:00'), 'person-1'),
    tag(timed('Zahnarzt', '2026-10-28T12:00', '2026-10-28T13:00')),
  ];
  const run = (events = kitaEvents, tab: 'all' | 'family' | 'person-1' = 'all', keyword = 'kita') =>
    splitKita(buildDays(visibleEvents(applyTab(events, tab), now, tz), now, tz), {
      keyword,
      tab,
    });

  it('lists family events containing the keyword for today and tomorrow, case-insensitively', () => {
    const { kita } = run();
    expect(kita.map((entry) => entry.event.title)).toEqual(['Kita holen – Alex', 'KITA bringen']);
    expect(kita.map((entry) => entry.date)).toEqual(['2026-10-28', '2026-10-29']);
  });

  it('ignores work events and events after tomorrow', () => {
    const titlesInBlock = run().kita.map((entry) => entry.event.title);
    expect(titlesInBlock).not.toContain('Kita-Fest');
    expect(titlesInBlock).not.toContain('Kita Elternabend');
  });

  it('removes block events from the agenda in Alle and Familie', () => {
    for (const tab of ['all', 'family'] as const) {
      const { days: rest } = run(kitaEvents, tab);
      const all = rest.flatMap((group) => titles(group));
      expect(all, tab).not.toContain('Kita holen – Alex');
      expect(all, tab).not.toContain('KITA bringen');
      expect(all, tab).toContain('Zahnarzt');
      expect(all, tab).toContain('Kita Elternabend');
    }
  });

  it('shows no block and keeps the events in a person tab', () => {
    const { kita, days: rest } = run(kitaEvents, 'person-1');
    expect(kita).toEqual([]);
    expect(rest.flatMap((group) => titles(group))).toContain('Kita-Fest');
  });

  it('uses the given keyword instead of a built-in word', () => {
    const { kita } = run(
      [tag(timed('Hort abholen', '2026-10-28T14:00', '2026-10-28T15:00'))],
      'all',
      'Hort',
    );
    expect(kita).toHaveLength(1);
  });

  it('returns no block entries without a match and leaves the days alone', () => {
    const { kita, days: rest } = run([
      tag(timed('Zahnarzt', '2026-10-28T12:00', '2026-10-28T13:00')),
    ]);
    expect(kita).toEqual([]);
    expect(rest.flatMap((group) => titles(group))).toEqual(['Zahnarzt']);
  });

  it('removes an ended Kita event from the block', () => {
    const { kita } = run([tag(timed('Kita bringen', '2026-10-28T06:30', '2026-10-28T07:00'))]);
    expect(kita).toEqual([]);
  });

  it('exports the settings fixture for the other tests', () => {
    expect(settingsFixture.calendars).toHaveLength(3);
  });
});

describe('kitaLabel', () => {
  it('removes the keyword and its separators from the title', () => {
    expect(kitaLabel('Kita Kind Hinbringen', 'Kita')).toBe('Kind Hinbringen');
    expect(kitaLabel('KITA: Kind abholen', 'kita')).toBe('Kind abholen');
    expect(kitaLabel('Kind abholen – Kita', 'Kita')).toBe('Kind abholen');
    expect(kitaLabel('Kita holen – Alex', 'Kita')).toBe('holen – Alex');
  });

  it('keeps the full title when nothing else is left', () => {
    expect(kitaLabel('Kita', 'Kita')).toBe('Kita');
    expect(kitaLabel(' kita ', 'Kita')).toBe('kita');
  });
});
