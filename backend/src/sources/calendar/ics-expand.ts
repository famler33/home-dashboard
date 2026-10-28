import ICAL from 'ical.js';
import { FeedRejected } from './feed-url.js';
import type { CalendarEvent, CalendarPayload } from './types.js';

const MAX_EVENTS = 200;
const MAX_TITLE = 120;
const MAX_UID = 100;
const MAX_STEPS_PER_RULE = 20_000;
const MAX_STEPS_PER_FEED = 100_000;
const DAY_MS = 86_400_000;

export interface ExpandOptions {
  now: Date;
  timezone: string;
  /** Addresses of the calendar owner, used to recognise declined invitations. */
  selfAddresses: readonly string[];
}

interface Candidate {
  sortMs: number;
  event: CalendarEvent;
}

function offsetMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return wall - Math.floor(ms / 1000) * 1000;
}

/** The instant at which the wall clock of `timeZone` shows the given fields. */
function zonedToUtcMs(
  fields: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
): number {
  const guess = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second,
  );
  const first = guess - offsetMs(guess, timeZone);
  const second = guess - offsetMs(first, timeZone);
  return second;
}

function localDate(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function dayStartMs(date: string, timeZone: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return zonedToUtcMs({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone);
}

function isKnownZone(time: ICAL.Time): boolean {
  const zone = time.zone;
  if (zone === ICAL.Timezone.utcTimezone) return true;
  if (!zone || zone === ICAL.Timezone.localTimezone) return false;
  return ICAL.TimezoneService.has(zone.tzid);
}

/** Floating times and unknown zones (for example Windows names) count as household time. */
function toMs(time: ICAL.Time, timeZone: string): number {
  if (isKnownZone(time)) return time.toJSDate().getTime();
  return zonedToUtcMs(
    {
      year: time.year,
      month: time.month,
      day: time.day,
      hour: time.hour,
      minute: time.minute,
      second: time.second,
    },
    timeZone,
  );
}

function cleanTitle(raw: string | undefined | null): string {
  return (raw ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE);
}

function normaliseAddress(value: unknown): string {
  return String(value ?? '')
    .replace(/^mailto:/i, '')
    .trim()
    .toLowerCase();
}

export function expandCalendar(text: string, options: ExpandOptions): CalendarPayload {
  const { timezone } = options;
  const self = new Set(options.selfAddresses.map(normaliseAddress));
  const today = localDate(options.now.getTime(), timezone);
  const winStartDate = addDays(today, -1);
  const winEndDate = addDays(today, 7);
  const winStartMs = dayStartMs(winStartDate, timezone);
  const winEndMs = dayStartMs(winEndDate, timezone);

  const candidates: Candidate[] = [];
  let truncated = false;
  let totalSteps = 0;

  function consider(item: ICAL.Event, start: ICAL.Time, end: ICAL.Time): void {
    const status = String(item.component.getFirstPropertyValue('status') ?? '').toUpperCase();
    if (status === 'CANCELLED') return;
    let tentative = status === 'TENTATIVE';
    for (const attendee of item.component.getAllProperties('attendee')) {
      if (!self.has(normaliseAddress(attendee.getFirstValue()))) continue;
      const part = String(attendee.getParameter('partstat') ?? '').toUpperCase();
      if (part === 'DECLINED') return;
      if (part === 'TENTATIVE') tentative = true;
    }
    const title = cleanTitle(item.summary);
    const uid = String(item.uid ?? '').slice(0, MAX_UID);

    if (start.isDate) {
      const startDate = start.toString();
      let endDate = end.toString();
      if (endDate <= startDate) endDate = addDays(startDate, 1);
      if (!(startDate < winEndDate && endDate > winStartDate)) return;
      candidates.push({
        sortMs: dayStartMs(startDate, timezone),
        event: { uid, title, allDay: true, start: startDate, end: endDate, tentative },
      });
      return;
    }
    const startMs = toMs(start, timezone);
    const endMs = Math.max(toMs(end, timezone), startMs);
    const overlaps =
      startMs < winEndMs && (endMs > winStartMs || (endMs === startMs && startMs >= winStartMs));
    if (!overlaps) return;
    candidates.push({
      sortMs: startMs,
      event: {
        uid,
        title,
        allDay: false,
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        tentative,
      },
    });
  }

  try {
    ICAL.TimezoneService.reset();
    const root = new ICAL.Component(ICAL.parse(text));
    for (const zone of root.getAllSubcomponents('vtimezone')) {
      try {
        ICAL.TimezoneService.register(zone);
      } catch {
        // an unusable zone definition counts as an unknown zone
      }
    }

    const events = root.getAllSubcomponents('vevent').flatMap((component) => {
      try {
        return [new ICAL.Event(component)];
      } catch {
        return [];
      }
    });
    const masters = new Map<string, ICAL.Event>();
    for (const event of events) if (!event.isRecurrenceException()) masters.set(event.uid, event);
    const standalone: ICAL.Event[] = [];
    for (const event of events) {
      if (!event.isRecurrenceException()) continue;
      const master = masters.get(event.uid);
      if (master) master.relateException(event);
      else standalone.push(event);
    }

    for (const event of [...masters.values(), ...standalone]) {
      try {
        if (!event.isRecurring()) {
          consider(event, event.startDate, event.endDate);
          continue;
        }
        const iterator = event.iterator();
        let steps = 0;
        for (let next = iterator.next(); next; next = iterator.next()) {
          steps += 1;
          totalSteps += 1;
          if (steps > MAX_STEPS_PER_RULE || totalSteps > MAX_STEPS_PER_FEED) {
            truncated = true;
            break;
          }
          if (toMs(next, timezone) >= winEndMs) break;
          const details = event.getOccurrenceDetails(next);
          consider(details.item, details.startDate, details.endDate);
        }
      } catch {
        // one broken event never hides the others
      }
    }
  } catch {
    throw new FeedRejected('parse');
  } finally {
    ICAL.TimezoneService.reset();
  }

  candidates.sort(
    (a, b) => a.sortMs - b.sortMs || a.event.title.localeCompare(b.event.title, 'de'),
  );
  if (candidates.length > MAX_EVENTS) truncated = true;
  return { events: candidates.slice(0, MAX_EVENTS).map((entry) => entry.event), truncated };
}
