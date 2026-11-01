import { dedupe } from './merge';
import { addDays, localDate } from './format';
import type { CalendarTab, TaggedEvent } from './types';
import { zonedStartMs } from './zone';

export type DayKind = 'today' | 'tomorrow' | 'date';

export interface DayItem {
  event: TaggedEvent;
  /** Set for multi-day events: which day of how many this is. */
  part: { index: number; total: number } | null;
  key: string;
}

export interface DayGroup {
  date: string;
  kind: DayKind;
  items: DayItem[];
}

const DAYS = 4;

export function dayKind(date: string, today: string): DayKind {
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  return 'date';
}

export function applyTab(events: readonly TaggedEvent[], tab: CalendarTab): TaggedEvent[] {
  if (tab === 'all') return dedupe(events);
  return events.filter((event) => event.calendar === tab);
}

/** Hides ended appointments of today; all-day appointments stay for their whole days. */
export function visibleEvents(
  events: readonly TaggedEvent[],
  now: number,
  timeZone: string,
): TaggedEvent[] {
  const today = localDate(now, timeZone);
  return events.filter((event) => {
    if (event.allDay) return event.end > today;
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    return end > start ? end > now : start >= now;
  });
}

function coveredDates(event: TaggedEvent, timeZone: string): string[] {
  const first = event.allDay ? event.start : localDate(Date.parse(event.start), timeZone);
  const last = event.allDay
    ? addDays(event.end, -1)
    : localDate(Math.max(Date.parse(event.end) - 1, Date.parse(event.start)), timeZone);
  const dates: string[] = [];
  for (let date = first; date <= last && dates.length < 60; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates.length > 0 ? dates : [first];
}

export function buildDays(
  events: readonly TaggedEvent[],
  now: number,
  timeZone: string,
  count: number = DAYS,
): DayGroup[] {
  const today = localDate(now, timeZone);
  const dates = Array.from({ length: count }, (_, offset) => addDays(today, offset));
  const byDate = new Map<string, DayItem[]>(dates.map((date) => [date, []]));

  for (const event of events) {
    const covered = coveredDates(event, timeZone);
    covered.forEach((date, position) => {
      const items = byDate.get(date);
      if (!items) return;
      items.push({
        event,
        part: covered.length > 1 ? { index: position + 1, total: covered.length } : null,
        key: `${event.calendar}|${event.uid}|${event.start}|${date}`,
      });
    });
  }

  const sortKey = (item: DayItem): [number, number, number, string] => {
    const lead = item.event.allDay || (item.part !== null && item.part.index > 1) ? 0 : 1;
    const start = item.event.allDay
      ? zonedStartMs(item.event.start, timeZone)
      : Date.parse(item.event.start);
    return [lead, start, item.event.role === 'family' ? 0 : 1, item.event.title];
  };

  return dates
    .map((date) => {
      const items = byDate.get(date) ?? [];
      items.sort((a, b) => {
        const x = sortKey(a);
        const y = sortKey(b);
        return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || x[3].localeCompare(y[3], 'de');
      });
      return { date, kind: dayKind(date, today), items };
    })
    .filter((group) => group.items.length > 0 || group.kind === 'today');
}

export interface KitaEntry {
  date: string;
  event: TaggedEvent;
  part: DayItem['part'];
  key: string;
}

/**
 * Moves family appointments of today and tomorrow that contain the keyword into the Kita block.
 * In a person's tab there is no block and nothing moves.
 */
export function splitKita(
  days: readonly DayGroup[],
  options: { keyword: string; tab: CalendarTab },
): { kita: KitaEntry[]; days: DayGroup[] } {
  if (options.tab !== 'all' && options.tab !== 'family') return { kita: [], days: [...days] };
  const needle = options.keyword.trim().toLowerCase();
  if (needle === '') return { kita: [], days: [...days] };

  const kita: KitaEntry[] = [];
  const rest = days
    .map((group) => {
      if (group.kind === 'date') return group;
      const keep: DayItem[] = [];
      for (const item of group.items) {
        if (item.event.role === 'family' && item.event.title.toLowerCase().includes(needle)) {
          kita.push({ date: group.date, event: item.event, part: item.part, key: item.key });
        } else {
          keep.push(item);
        }
      }
      return { ...group, items: keep };
    })
    .filter((group) => group.items.length > 0 || group.kind === 'today');
  return { kita, days: rest };
}

/** The Kita title without the keyword, so "Kita Kind Hinbringen" reads "Kind Hinbringen". */
export function kitaLabel(title: string, keyword: string): string {
  const full = title.trim();
  const needle = keyword.trim();
  if (needle === '') return full;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = full
    .replace(new RegExp(escaped, 'i'), '')
    .replace(/^[\s:–—\-·,]+|[\s:–—\-·,]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped === '' ? full : stripped;
}
