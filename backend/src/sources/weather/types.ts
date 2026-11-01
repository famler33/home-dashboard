import { Type, type Static } from '@sinclair/typebox';

const iso = Type.String({ minLength: 10 });
const condition = Type.Union(
  [
    'clear',
    'mostly-clear',
    'partly-cloudy',
    'overcast',
    'fog',
    'drizzle',
    'rain',
    'showers',
    'snow',
    'thunderstorm',
    'unknown',
  ].map((value) => Type.Literal(value)),
);

export const weatherPayloadSchema = Type.Object({
  location: Type.Object({ name: Type.String() }),
  current: Type.Object({
    temperature: Type.Number(),
    condition,
    isDay: Type.Boolean(),
    windKmh: Type.Number(),
    windDirection: Type.Number(),
  }),
  today: Type.Object({
    max: Type.Number(),
    min: Type.Number(),
    precipProbability: Type.Number(),
  }),
  hourly: Type.Array(
    Type.Object({
      time: iso,
      temperature: Type.Number(),
      condition,
      isDay: Type.Boolean(),
      precipProbability: Type.Number(),
    }),
  ),
  daily: Type.Array(
    Type.Object({
      date: iso,
      max: Type.Number(),
      min: Type.Number(),
      condition,
      precipProbability: Type.Number(),
    }),
  ),
  rainSeries: Type.Array(Type.Object({ time: iso, mmPerHour: Type.Number() })),
});
export type WeatherPayload = Static<typeof weatherPayloadSchema>;

const frameKind = Type.Union([Type.Literal('observed'), Type.Literal('forecast')]);

export const radarPayloadSchema = Type.Object({
  version: Type.String(),
  frames: Type.Array(Type.Object({ time: iso, kind: frameKind })),
  homeSeries: Type.Array(Type.Object({ time: iso, mmPerHour: Type.Number() })),
});
export type RadarPayload = Static<typeof radarPayloadSchema>;

export const alertsPayloadSchema = Type.Object({
  alerts: Type.Array(
    Type.Object({
      id: Type.String(),
      type: Type.String(),
      severity: Type.Union([
        Type.Literal('minor'),
        Type.Literal('moderate'),
        Type.Literal('severe'),
        Type.Literal('extreme'),
      ]),
      onset: iso,
      expires: iso,
    }),
  ),
});
export type AlertsPayload = Static<typeof alertsPayloadSchema>;

export const radarDocumentSchema = Type.Object({
  version: Type.String(),
  size: Type.Integer(),
  corners: Type.Array(Type.Tuple([Type.Number(), Type.Number()]), { minItems: 4, maxItems: 4 }),
  home: Type.Object({
    col: Type.Number(),
    row: Type.Number(),
    lat: Type.Number(),
    lon: Type.Number(),
  }),
  map: Type.Object({
    zoom: Type.Integer(),
    tileSize: Type.Integer(),
    tiles: Type.Array(Type.Object({ x: Type.Integer(), y: Type.Integer() })),
  }),
  frames: Type.Array(Type.Object({ time: iso, kind: frameKind, values: Type.String() })),
});
export type RadarDocument = Static<typeof radarDocumentSchema>;
