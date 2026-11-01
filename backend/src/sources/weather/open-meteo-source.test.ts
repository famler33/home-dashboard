import { readFileSync } from 'node:fs';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it, vi } from 'vitest';
import { createWeatherSource } from './open-meteo-source.js';
import { weatherPayloadSchema } from './types.js';

const fixture = JSON.parse(
  readFileSync(new URL('../../../test/fixtures/open-meteo.sample.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const location = { name: 'Zuhause', latitude: 52.5234, longitude: 13.405 };
const now = Date.parse('2026-10-28T13:50:00Z'); // 14:50 in Berlin (UTC+1)
const signal = new AbortController().signal;

function create(body: unknown = fixture, status = 200) {
  const fetchImpl = vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
  const source = createWeatherSource({
    location,
    timezone: 'Europe/Berlin',
    fetchImpl,
    userAgent: 'home-dashboard/test',
    now: () => now,
  });
  return { source, fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

// Covers: FR-1, FR-2, FR-4, FR-5, FR-6, FR-12, AC-1, AC-2, AC-5, AC-6, AC-9, AC-12, AC-36
describe('weather source', () => {
  it('declares its id, interval, stale threshold and timeout', () => {
    const { source } = create();
    expect(source.id).toBe('weather');
    expect(source.intervalSeconds).toBe(900);
    expect(source.staleAfterSeconds).toBe(1800);
    expect(source.timeoutMs).toBe(15_000);
  });

  it('maps the Open-Meteo fixture to current conditions and today values', async () => {
    const payload = await create().source.fetch(signal);
    expect(payload.location).toEqual({ name: 'Zuhause' });
    const current = fixture['current'] as Record<string, number>;
    expect(payload.current).toEqual({
      temperature: current['temperature_2m'],
      condition: expect.any(String),
      isDay: current['is_day'] === 1,
      windKmh: current['wind_speed_10m'],
      windDirection: current['wind_direction_10m'],
    });
    const daily = fixture['daily'] as Record<string, number[]>;
    expect(payload.today).toEqual({
      max: daily['temperature_2m_max']?.[0],
      min: daily['temperature_2m_min']?.[0],
      precipProbability: daily['precipitation_probability_max']?.[0],
    });
  });

  it('produces a payload that matches the shared schema', async () => {
    expect(Value.Check(weatherPayloadSchema, await create().source.fetch(signal))).toBe(true);
  });

  it('keeps 24 hourly slots after now starting with the next full hour, as ISO UTC', async () => {
    const { hourly } = await create().source.fetch(signal);
    expect(hourly).toHaveLength(24);
    expect(hourly[0]?.time).toBe('2026-10-28T14:00:00.000Z'); // 15:00 Berlin
    expect(hourly[1]?.time).toBe('2026-10-28T15:00:00.000Z');
    expect(hourly[0]).toMatchObject({
      temperature: expect.any(Number),
      condition: expect.any(String),
      isDay: expect.any(Boolean),
      precipProbability: expect.any(Number),
    });
  });

  it('maps seven daily entries with local dates', async () => {
    const { daily } = await create().source.fetch(signal);
    expect(daily).toHaveLength(7);
    expect(daily[0]?.date).toBe('2026-10-28');
    expect(daily[6]?.date).toBe('2026-11-03');
    expect(daily[0]).toMatchObject({ max: expect.any(Number), min: expect.any(Number) });
  });

  it('provides 16 fifteen-minute rain steps starting with the slot that contains now, in mm per hour', async () => {
    const { rainSeries } = await create().source.fetch(signal);
    expect(rainSeries).toHaveLength(16);
    expect(rainSeries[0]?.time).toBe('2026-10-28T13:45:00.000Z'); // 14:45 Berlin
    const minutely = fixture['minutely_15'] as { precipitation: number[] };
    expect(rainSeries[0]?.mmPerHour).toBeCloseTo((minutely.precipitation[1] ?? 0) * 4, 5);
  });

  it('puts the configured location name into the payload', async () => {
    const { source } = create();
    expect((await source.fetch(signal)).location.name).toBe('Zuhause');
  });

  it('requests the documented variables for the rounded home location and the time zone', async () => {
    const { source, fetchImpl } = create();
    await source.fetch(signal);
    const url = fetchImpl.mock.calls[0]?.[0] as URL;
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(url.pathname).toBe('/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('52.52');
    expect(url.searchParams.get('longitude')).toBe('13.41');
    expect(url.searchParams.get('timezone')).toBe('Europe/Berlin');
    expect(url.searchParams.get('forecast_days')).toBe('7');
    expect(url.searchParams.get('current')).toBe(
      'temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m',
    );
    expect(url.searchParams.get('hourly')).toBe(
      'temperature_2m,precipitation_probability,weather_code,is_day',
    );
    expect(url.searchParams.get('daily')).toBe(
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    );
    expect(url.searchParams.get('minutely_15')).toBe('precipitation');
  });

  it('requests Celsius and km/h defaults without unit overrides', async () => {
    const { source, fetchImpl } = create();
    await source.fetch(signal);
    const url = fetchImpl.mock.calls[0]?.[0] as URL;
    expect(url.searchParams.has('temperature_unit')).toBe(false);
    expect(url.searchParams.has('wind_speed_unit')).toBe(false);
  });

  it('passes the abort signal and sends the identifying user agent', async () => {
    const { source, fetchImpl } = create();
    await source.fetch(signal);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.signal).toBe(signal);
    expect(new Headers(init.headers).get('user-agent')).toBe('home-dashboard/test');
  });

  it('maps unknown weather codes to the unknown condition', async () => {
    const changed = structuredClone(fixture) as { current: Record<string, unknown> };
    changed.current['weather_code'] = 4;
    expect((await create(changed).source.fetch(signal)).current.condition).toBe('unknown');
  });

  it.each([
    ['a missing hourly block', (body: Record<string, unknown>) => delete body['hourly']],
    [
      'mismatched hourly lengths',
      (body: Record<string, unknown>) =>
        ((body['hourly'] as Record<string, unknown[]>)['temperature_2m'] = [1]),
    ],
    [
      'too few daily days',
      (body: Record<string, unknown>) =>
        ((body['daily'] as Record<string, unknown[]>)['time'] = ['2026-10-28']),
    ],
    ['a missing minutely block', (body: Record<string, unknown>) => delete body['minutely_15']],
    [
      'a non-numeric temperature',
      (body: Record<string, unknown>) =>
        ((body['current'] as Record<string, unknown>)['temperature_2m'] = 'warm'),
    ],
  ])('rejects %s', async (_label, mutate) => {
    const broken = structuredClone(fixture);
    mutate(broken);
    await expect(create(broken).source.fetch(signal)).rejects.toThrow();
  });

  it('rejects non-ok responses', async () => {
    await expect(create({}, 500).source.fetch(signal)).rejects.toThrow();
  });
});
