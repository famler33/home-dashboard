export interface CalendarEvent {
  uid: string;
  title: string;
  allDay: boolean;
  /** Timed: ISO UTC instant. All-day: local date `YYYY-MM-DD`. */
  start: string;
  /** Timed: ISO UTC instant. All-day: local date, exclusive. */
  end: string;
  tentative: boolean;
}

export interface CalendarPayload {
  events: CalendarEvent[];
  truncated: boolean;
}

export type CalendarId = 'family' | 'person-1' | 'person-2';
export type CalendarColor = 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'rose';

export interface CalendarInfo {
  id: CalendarId;
  name: string;
  color: CalendarColor;
  role: 'family' | 'person';
}

export interface CalendarSettings {
  kitaKeyword: string;
  calendars: CalendarInfo[];
}

export interface TaggedEvent extends CalendarEvent {
  calendar: CalendarId;
  role: 'family' | 'person';
  color: CalendarColor;
  calendarName: string;
}

export type CalendarTab = 'all' | 'family' | 'person-1' | 'person-2';

const colors: readonly string[] = ['blue', 'green', 'orange', 'purple', 'teal', 'rose'];
const ids: readonly string[] = ['family', 'person-1', 'person-2'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEvent(value: unknown): value is CalendarEvent {
  return (
    isRecord(value) &&
    typeof value['uid'] === 'string' &&
    typeof value['title'] === 'string' &&
    typeof value['allDay'] === 'boolean' &&
    typeof value['start'] === 'string' &&
    typeof value['end'] === 'string' &&
    typeof value['tentative'] === 'boolean'
  );
}

export function isCalendarPayload(value: unknown): value is CalendarPayload {
  return (
    isRecord(value) &&
    typeof value['truncated'] === 'boolean' &&
    Array.isArray(value['events']) &&
    value['events'].every(isEvent)
  );
}

export function isCalendarSettings(value: unknown): value is CalendarSettings {
  return (
    isRecord(value) &&
    typeof value['kitaKeyword'] === 'string' &&
    Array.isArray(value['calendars']) &&
    value['calendars'].every(
      (entry) =>
        isRecord(entry) &&
        typeof entry['id'] === 'string' &&
        ids.includes(entry['id']) &&
        typeof entry['name'] === 'string' &&
        typeof entry['color'] === 'string' &&
        colors.includes(entry['color']) &&
        (entry['role'] === 'family' || entry['role'] === 'person'),
    )
  );
}
