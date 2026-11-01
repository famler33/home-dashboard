import { readFileSync } from 'node:fs';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it, vi } from 'vitest';
import { createAlertsSource } from './alerts-source.js';
import { alertsPayloadSchema } from './types.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../test/fixtures/brightsky-alerts.sample.json', import.meta.url),
    'utf8',
  ),
) as { alerts: Record<string, unknown>[] };

const location = { name: 'Zuhause', latitude: 52.5234, longitude: 13.405 };
const now = Date.parse('2026-10-28T13:50:00Z');
const signal = new AbortController().signal;

function create(body: unknown = fixture) {
  const fetchImpl = vi.fn(
    async () => new Response(JSON.stringify(body)),
  ) as unknown as typeof fetch;
  const source = createAlertsSource({
    location,
    fetchImpl,
    userAgent: 'home-dashboard/test',
    now: () => now,
  });
  return { source, fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

// Covers: FR-11, FR-12, AC-31, AC-33, AC-36
describe('alerts source', () => {
  it('declares its id, interval, stale threshold and timeout', () => {
    const { source } = create();
    expect(source.id).toBe('weather-alerts');
    expect(source.intervalSeconds).toBe(900);
    expect(source.staleAfterSeconds).toBe(1800);
    expect(source.timeoutMs).toBe(15_000);
  });

  it('maps active alerts and drops expired, test and unknown-severity ones', async () => {
    const payload = await create().source.fetch(signal);
    expect(payload.alerts.map((alert) => alert.type)).toEqual(['Gewitter', 'Windböen']);
    expect(Value.Check(alertsPayloadSchema, payload)).toBe(true);
  });

  it('orders by severity then onset', async () => {
    const payload = await create().source.fetch(signal);
    expect(payload.alerts.map((alert) => alert.severity)).toEqual(['severe', 'moderate']);
    expect(payload.alerts[0]?.onset).toBe('2026-10-28T16:00:00.000Z');
  });

  it('keeps at most five alerts', async () => {
    const many = {
      alerts: Array.from({ length: 8 }, (_, index) => ({
        ...fixture.alerts[0],
        id: index + 100,
        alert_id: `x-${index}`,
        onset: `2026-10-28T1${index}:00:00+00:00`,
      })),
    };
    expect((await create(many).source.fetch(signal)).alerts).toHaveLength(5);
  });

  it('drops alerts that start more than twelve hours ahead', async () => {
    const far = {
      alerts: [
        {
          ...fixture.alerts[0],
          onset: '2026-10-29T10:00:00+00:00',
          expires: '2026-10-29T20:00:00+00:00',
        },
      ],
    };
    expect((await create(far).source.fetch(signal)).alerts).toEqual([]);
  });

  it('cuts very long event names at 40 characters', async () => {
    const long = { alerts: [{ ...fixture.alerts[0], event_de: 'A'.repeat(80) }] };
    const [alert] = (await create(long).source.fetch(signal)).alerts;
    expect(alert?.type.length).toBe(40);
  });

  it('returns an empty list when nothing is active', async () => {
    expect(await create({ alerts: [] }).source.fetch(signal)).toEqual({ alerts: [] });
  });

  it('requests the alerts for the rounded home location only', async () => {
    const { source, fetchImpl } = create();
    await source.fetch(signal);
    const url = fetchImpl.mock.calls[0]?.[0] as URL;
    expect(url.hostname).toBe('api.brightsky.dev');
    expect(url.pathname).toBe('/alerts');
    expect(url.searchParams.get('lat')).toBe('52.52');
    expect(url.searchParams.get('lon')).toBe('13.41');
    expect([...url.searchParams.keys()].sort()).toEqual(['lat', 'lon']);
  });

  it('rejects a response without an alerts array', async () => {
    await expect(create({ nothing: true }).source.fetch(signal)).rejects.toThrow();
  });
});
