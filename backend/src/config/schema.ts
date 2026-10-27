import { Type, type Static } from '@sinclair/typebox';

const hhmm = Type.String({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' });

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
      { demo: Type.Object({ enabled: Type.Boolean() }, { additionalProperties: false }) },
      { additionalProperties: false },
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
}
