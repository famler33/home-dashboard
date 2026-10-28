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
