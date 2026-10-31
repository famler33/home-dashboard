import { Type, type Static } from '@sinclair/typebox';

const hhmm = Type.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' });

export const calendarColors = ['blue', 'green', 'orange', 'purple', 'teal', 'rose'] as const;
export type CalendarColor = (typeof calendarColors)[number];
export const calendarIds = ['family', 'person-1', 'person-2'] as const;
export type CalendarId = (typeof calendarIds)[number];

const calendarSetting = Type.Object(
  {
    enabled: Type.Boolean(),
    name: Type.String({ minLength: 1, maxLength: 20 }),
    color: Type.Union(calendarColors.map((color) => Type.Literal(color))),
    selfAddresses: Type.Optional(
      Type.Array(Type.String({ pattern: '^[^@\\s]+@[^@\\s]+$' }), { maxItems: 5 }),
    ),
  },
  { additionalProperties: false },
);

export const settingsSchema = Type.Object(
  {
    timezone: Type.String({ minLength: 1 }),
    location: Type.Object(
      {
        name: Type.String({ minLength: 1 }),
        latitude: Type.Number({ minimum: -90, maximum: 90 }),
        longitude: Type.Number({ minimum: -180, maximum: 180 }),
      },
      { additionalProperties: false },
    ),
    display: Type.Object(
      { nightFrom: hhmm, nightTo: hhmm, dailyReloadAt: hhmm },
      { additionalProperties: false },
    ),
    sources: Type.Object(
      {
        demo: Type.Object({ enabled: Type.Boolean() }, { additionalProperties: false }),
        weather: Type.Optional(
          Type.Object({ enabled: Type.Boolean() }, { additionalProperties: false }),
        ),
        calendar: Type.Optional(
          Type.Object(
            {
              enabled: Type.Boolean(),
              kitaKeyword: Type.String({ minLength: 1, maxLength: 30 }),
              calendars: Type.Object(
                {
                  family: calendarSetting,
                  'person-1': calendarSetting,
                  'person-2': calendarSetting,
                },
                { additionalProperties: false },
              ),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
    network: Type.Optional(
      Type.Object(
        {
          /** Host names (no scheme, no port) the API answers to; loopback is always allowed. */
          allowedHosts: Type.Array(
            Type.String({
              pattern:
                '^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\\[[0-9a-f:]+\\])$',
            }),
            { minItems: 1, maxItems: 10 },
          ),
        },
        { additionalProperties: false },
      ),
    ),
    backup: Type.Object(
      { time: hhmm, retention: Type.Integer({ minimum: 1, maximum: 60 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export type Settings = Static<typeof settingsSchema>;

export const credentialsSchema = Type.Record(
  Type.String({ pattern: '^[a-z][a-z0-9-]*$' }),
  Type.Record(Type.String(), Type.String()),
);

export type Credentials = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface SnapshotSettings {
  timezone: string;
  display: { nightFrom: string; nightTo: string; dailyReloadAt: string };
  calendar?: {
    kitaKeyword: string;
    calendars: {
      id: CalendarId;
      name: string;
      color: CalendarColor;
      role: 'family' | 'person';
    }[];
  };
}
