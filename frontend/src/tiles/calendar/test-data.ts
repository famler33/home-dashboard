import type { CalendarEvent, CalendarSettings, TaggedEvent } from './types';

/** Wednesday 2026-10-28, 11:00 in Berlin. */
export const calendarNow = Date.parse('2026-10-28T10:00:00Z');
export const tz = 'Europe/Berlin';

export const settingsFixture: CalendarSettings = {
  kitaKeyword: 'Kita',
  calendars: [
    { id: 'family', name: 'Familie', color: 'blue', role: 'family' },
    { id: 'person-1', name: 'Alex', color: 'green', role: 'person' },
    { id: 'person-2', name: 'Ben', color: 'orange', role: 'person' },
  ],
};

export function timed(
  title: string,
  startUtc: string,
  endUtc: string,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    uid: `${title}@test`,
    title,
    allDay: false,
    start: `${startUtc}:00.000Z`.replace('Z:00.000Z', ':00.000Z'),
    end: `${endUtc}:00.000Z`.replace('Z:00.000Z', ':00.000Z'),
    tentative: false,
    ...extra,
  };
}

export function allDay(
  title: string,
  start: string,
  end: string,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent {
  return { uid: `${title}@test`, title, allDay: true, start, end, tentative: false, ...extra };
}

export function tag(
  event: CalendarEvent,
  calendar: 'family' | 'person-1' | 'person-2' = 'family',
): TaggedEvent {
  const info = settingsFixture.calendars.find((entry) => entry.id === calendar)!;
  return { ...event, calendar, role: info.role, color: info.color, calendarName: info.name };
}
