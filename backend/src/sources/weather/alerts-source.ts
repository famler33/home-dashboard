import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type { Settings } from '../../config/schema.js';
import type { Source } from '../source.js';
import { getJson, roundForUpstream, UpstreamError } from './http.js';
import type { AlertsPayload } from './types.js';

const MAX_ALERTS = 5;
const LOOKAHEAD_MS = 12 * 3_600_000;
const MAX_TYPE_LENGTH = 40;
const MAX_BYTES = 500_000;

const severityRank = { minor: 1, moderate: 2, severe: 3, extreme: 4 } as const;
type Severity = keyof typeof severityRank;

const upstreamSchema = Type.Object({ alerts: Type.Array(Type.Unknown()) });
const alertSchema = Type.Object({
  status: Type.String(),
  onset: Type.String(),
  expires: Type.String(),
  severity: Type.String(),
  event_de: Type.String(),
  alert_id: Type.Optional(Type.String()),
  id: Type.Optional(Type.Union([Type.Number(), Type.String()])),
});

function isSeverity(value: string): value is Severity {
  return value in severityRank;
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(
      /(^|[\s/-])(\p{L})/gu,
      (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
    )
    .slice(0, MAX_TYPE_LENGTH);
}

export function createAlertsSource(deps: {
  location: Settings['location'];
  fetchImpl: typeof fetch;
  userAgent: string;
  now?: () => number;
}): Source<AlertsPayload> {
  const now = deps.now ?? Date.now;

  return {
    id: 'weather-alerts',
    intervalSeconds: 900,
    staleAfterSeconds: 1800,
    timeoutMs: 15_000,
    async fetch(signal) {
      const url = new URL('https://api.brightsky.dev/alerts');
      url.searchParams.set('lat', String(roundForUpstream(deps.location.latitude)));
      url.searchParams.set('lon', String(roundForUpstream(deps.location.longitude)));

      const raw = await getJson(deps.fetchImpl, url, {
        signal,
        userAgent: deps.userAgent,
        maxBytes: MAX_BYTES,
      });
      if (!Value.Check(upstreamSchema, raw)) throw new UpstreamError();

      const nowMs = now();
      const alerts: (AlertsPayload['alerts'][number] & { rank: number; onsetMs: number })[] = [];
      for (const item of raw.alerts) {
        if (!Value.Check(alertSchema, item)) continue;
        const severity = item.severity.toLowerCase();
        const onsetMs = Date.parse(item.onset);
        const expiresMs = Date.parse(item.expires);
        if (
          item.status !== 'actual' ||
          !isSeverity(severity) ||
          Number.isNaN(onsetMs) ||
          Number.isNaN(expiresMs) ||
          expiresMs <= nowMs ||
          onsetMs > nowMs + LOOKAHEAD_MS
        ) {
          continue;
        }
        alerts.push({
          id: String(item.alert_id ?? item.id ?? `${onsetMs}`),
          type: titleCase(item.event_de),
          severity,
          onset: new Date(onsetMs).toISOString(),
          expires: new Date(expiresMs).toISOString(),
          rank: severityRank[severity],
          onsetMs,
        });
      }
      alerts.sort((a, b) => b.rank - a.rank || a.onsetMs - b.onsetMs);

      return {
        alerts: alerts.slice(0, MAX_ALERTS).map((alert) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          onset: alert.onset,
          expires: alert.expires,
        })),
      };
    },
  };
}
