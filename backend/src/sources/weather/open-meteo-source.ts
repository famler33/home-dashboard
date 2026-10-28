import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { Settings } from '../../config/schema.js';
import type { Source } from '../source.js';
import { wmoToCondition } from './conditions.js';
import { getJson, roundForUpstream, UpstreamError } from './http.js';
import type { WeatherPayload } from './types.js';

const HOURLY_SLOTS = 24;
const DAILY_SLOTS = 7;
const RAIN_STEPS = 16;
const MAX_BYTES = 1_000_000;

const nullableNumbers = Type.Array(Type.Union([Type.Number(), Type.Null()]));

const upstreamSchema = Type.Object({
  utc_offset_seconds: Type.Number(),
  current: Type.Object({
    temperature_2m: Type.Number(),
    weather_code: Type.Union([Type.Number(), Type.Null()]),
    is_day: Type.Number(),
    wind_speed_10m: Type.Number(),
    wind_direction_10m: Type.Number(),
  }),
  hourly: Type.Object({
    time: Type.Array(Type.String()),
    temperature_2m: Type.Array(Type.Number()),
    precipitation_probability: nullableNumbers,
    weather_code: nullableNumbers,
    is_day: Type.Array(Type.Number()),
  }),
  daily: Type.Object({
    time: Type.Array(Type.String()),
    temperature_2m_max: Type.Array(Type.Number()),
    temperature_2m_min: Type.Array(Type.Number()),
    precipitation_probability_max: nullableNumbers,
    weather_code: nullableNumbers,
  }),
  minutely_15: Type.Object({
    time: Type.Array(Type.String()),
    precipitation: nullableNumbers,
  }),
});

function sameLength(...lists: unknown[][]): boolean {
  return lists.every((list) => list.length === lists[0]?.length);
}

export function createWeatherSource(deps: {
  location: Settings['location'];
  timezone: string;
  fetchImpl: typeof fetch;
  userAgent: string;
  now?: () => number;
}): Source<WeatherPayload> {
  const now = deps.now ?? Date.now;

  return {
    id: 'weather',
    intervalSeconds: 900,
    staleAfterSeconds: 1800,
    timeoutMs: 15_000,
    async fetch(signal) {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(roundForUpstream(deps.location.latitude)));
      url.searchParams.set('longitude', String(roundForUpstream(deps.location.longitude)));
      url.searchParams.set('timezone', deps.timezone);
      url.searchParams.set('forecast_days', String(DAILY_SLOTS));
      url.searchParams.set('forecast_hours', String(HOURLY_SLOTS + 1));
      url.searchParams.set('forecast_minutely_15', String(RAIN_STEPS + 1));
      url.searchParams.set('past_minutely_15', '1');
      url.searchParams.set(
        'current',
        'temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m',
      );
      url.searchParams.set(
        'hourly',
        'temperature_2m,precipitation_probability,weather_code,is_day',
      );
      url.searchParams.set(
        'daily',
        'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      );
      url.searchParams.set('minutely_15', 'precipitation');

      const raw = await getJson(deps.fetchImpl, url, {
        signal,
        userAgent: deps.userAgent,
        maxBytes: MAX_BYTES,
      });
      if (!Value.Check(upstreamSchema, raw)) throw new UpstreamError();
      const data = raw;
      const { hourly, daily, minutely_15: minutely } = data;
      if (
        !sameLength(
          hourly.time,
          hourly.temperature_2m,
          hourly.precipitation_probability,
          hourly.weather_code,
          hourly.is_day,
        ) ||
        !sameLength(
          daily.time,
          daily.temperature_2m_max,
          daily.temperature_2m_min,
          daily.precipitation_probability_max,
          daily.weather_code,
        ) ||
        !sameLength(minutely.time, minutely.precipitation) ||
        daily.time.length < DAILY_SLOTS ||
        hourly.time.length < HOURLY_SLOTS
      ) {
        throw new UpstreamError();
      }

      const offset = data.utc_offset_seconds;
      const nowMs = now();

      const hourlySlots: WeatherPayload['hourly'] = [];
      hourly.time.forEach((local, index) => {
        const ms = Date.parse(`${local}:00Z`) - offset * 1000;
        if (ms <= nowMs || hourlySlots.length >= HOURLY_SLOTS) return;
        hourlySlots.push({
          time: new Date(ms).toISOString(),
          temperature: hourly.temperature_2m[index] ?? 0,
          condition: wmoToCondition(hourly.weather_code[index]),
          isDay: hourly.is_day[index] === 1,
          precipProbability: hourly.precipitation_probability[index] ?? 0,
        });
      });
      if (hourlySlots.length < HOURLY_SLOTS) throw new UpstreamError();

      const steps = minutely.time.map((local, index) => ({
        ms: Date.parse(`${local}:00Z`) - offset * 1000,
        mmPerHour: (minutely.precipitation[index] ?? 0) * 4,
      }));
      const containing = steps.findLastIndex((step) => step.ms <= nowMs);
      const rainSeries = steps
        .slice(Math.max(0, containing), Math.max(0, containing) + RAIN_STEPS)
        .map((step) => ({ time: new Date(step.ms).toISOString(), mmPerHour: step.mmPerHour }));
      if (rainSeries.length < RAIN_STEPS) throw new UpstreamError();

      return {
        location: { name: deps.location.name },
        current: {
          temperature: data.current.temperature_2m,
          condition: wmoToCondition(data.current.weather_code),
          isDay: data.current.is_day === 1,
          windKmh: data.current.wind_speed_10m,
          windDirection: data.current.wind_direction_10m,
        },
        today: {
          max: daily.temperature_2m_max[0] ?? 0,
          min: daily.temperature_2m_min[0] ?? 0,
          precipProbability: daily.precipitation_probability_max[0] ?? 0,
        },
        hourly: hourlySlots,
        daily: daily.time.slice(0, DAILY_SLOTS).map((date, index) => ({
          date,
          max: daily.temperature_2m_max[index] ?? 0,
          min: daily.temperature_2m_min[index] ?? 0,
          condition: wmoToCondition(daily.weather_code[index]),
          precipProbability: daily.precipitation_probability_max[index] ?? 0,
        })),
        rainSeries,
      };
    },
  };
}
