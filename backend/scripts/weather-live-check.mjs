#!/usr/bin/env node
// Manual check of the three weather services (not part of any gate).
// Fetches each endpoint once with the home location from a settings.yaml and prints only the
// shapes (field names, counts, value ranges), never payload contents or coordinates.
//
//   node scripts/weather-live-check.mjs [path/to/settings.yaml]
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const settingsPath = process.argv[2] ?? 'infrastructure/config.example/settings.example.yaml';
const { location, timezone } = parse(readFileSync(settingsPath, 'utf8'));
const round = (value) => Math.round(value * 100) / 100;
const lat = round(location.latitude);
const lon = round(location.longitude);
const headers = { 'user-agent': 'home-dashboard/live-check' };
const nowMs = Date.now();

async function check(label, url, inspect) {
  try {
    const response = await fetch(url, { headers, redirect: 'error' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`ok   ${label}: ${inspect(await response.json())}`);
  } catch (error) {
    console.log(`FAIL ${label}: ${error instanceof Error ? error.message : 'error'}`);
    process.exitCode = 1;
  }
}

await check(
  'open-meteo forecast',
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(timezone)}&forecast_days=7&forecast_hours=25&forecast_minutely_15=17&past_minutely_15=1&current=temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&minutely_15=precipitation`,
  (body) =>
    `current keys=${Object.keys(body.current ?? {}).length}, hourly=${body.hourly?.time?.length}, daily=${body.daily?.time?.length}, minutely_15=${body.minutely_15?.time?.length}, utc_offset_seconds=${typeof body.utc_offset_seconds}`,
);

await check(
  'bright sky alerts',
  `https://api.brightsky.dev/alerts?lat=${lat}&lon=${lon}`,
  (body) => `alerts=${Array.isArray(body.alerts) ? body.alerts.length : 'missing'}`,
);

const date = new Date(nowMs - 3_600_000).toISOString();
const lastDate = new Date(nowMs + 2 * 3_600_000).toISOString();
await check(
  'bright sky radar',
  `https://api.brightsky.dev/radar?lat=${lat}&lon=${lon}&distance=50000&format=plain&date=${encodeURIComponent(date)}&last_date=${encodeURIComponent(lastDate)}`,
  (body) => {
    const frames = body.radar ?? [];
    const first = frames[0]?.precipitation_5;
    const newest = frames.at(-1)?.timestamp;
    return `frames=${frames.length}, grid=${first?.length}x${first?.[0]?.length}, corners=${body.geometry?.coordinates?.length}, newest=${newest ? Math.round((Date.parse(newest) - nowMs) / 60000) : '?'} min from now`;
  },
);

const tile = await fetch('https://tile.openstreetmap.org/0/0/0.png', {
  headers,
  redirect: 'error',
}).catch(() => undefined);
console.log(
  tile?.ok ? 'ok   openstreetmap tile: reachable' : 'FAIL openstreetmap tile: not reachable',
);
if (!tile?.ok) process.exitCode = 1;
