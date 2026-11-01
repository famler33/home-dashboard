import { Type, type Static } from '@sinclair/typebox';

export const calendarEventSchema = Type.Object({
  uid: Type.String({ maxLength: 100 }),
  title: Type.String({ maxLength: 120 }),
  allDay: Type.Boolean(),
  /** Timed: ISO UTC instant. All-day: local date `YYYY-MM-DD`. */
  start: Type.String({ minLength: 10 }),
  /** Timed: ISO UTC instant. All-day: local date, exclusive. */
  end: Type.String({ minLength: 10 }),
  tentative: Type.Boolean(),
});
export type CalendarEvent = Static<typeof calendarEventSchema>;

export const calendarPayloadSchema = Type.Object({
  events: Type.Array(calendarEventSchema, { maxItems: 200 }),
  truncated: Type.Boolean(),
});
export type CalendarPayload = Static<typeof calendarPayloadSchema>;
