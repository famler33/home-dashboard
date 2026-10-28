import type { SourceSnapshot } from '../../api/types';
import { isCalendarPayload, type CalendarSettings, type TaggedEvent } from './types';

/** Tags every event of every enabled calendar with its calendar, role and colour. */
export function mergeCalendars(
  entries: readonly SourceSnapshot[],
  settings: CalendarSettings,
): TaggedEvent[] {
  return settings.calendars.flatMap((info) => {
    const entry = entries.find((candidate) => candidate.id === `calendar-${info.id}`);
    if (!entry || !isCalendarPayload(entry.data)) return [];
    return entry.data.events.map((event) => ({
      ...event,
      calendar: info.id,
      role: info.role,
      color: info.color,
      calendarName: info.name,
    }));
  });
}

const rank = { family: 0, 'person-1': 1, 'person-2': 2 } as const;

/**
 * The same appointment in several calendars appears once: equal uid and start, or equal
 * title, start and end. The family copy wins, otherwise the first calendar in the fixed order.
 */
export function dedupe(events: readonly TaggedEvent[]): TaggedEvent[] {
  const seen = new Set<string>();
  const kept: TaggedEvent[] = [];
  const ordered = [...events].sort((a, b) => rank[a.calendar] - rank[b.calendar]);
  for (const event of ordered) {
    const byUid = `u|${event.uid}|${event.start}`;
    const byTitle = `t|${event.title.trim().toLowerCase()}|${event.start}|${event.end}`;
    if (seen.has(byUid) || seen.has(byTitle)) continue;
    seen.add(byUid);
    seen.add(byTitle);
    kept.push(event);
  }
  return kept;
}
