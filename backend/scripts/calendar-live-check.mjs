#!/usr/bin/env node
// Manual check of the calendar feeds (not part of any gate).
// Fetches each enabled calendar once with the real transport and prints only counts and shapes,
// never titles, addresses or feed text.
//
//   node --import tsx scripts/calendar-live-check.mjs <settings.yaml> <credentials.yaml>
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { createFeedTransport } from '../src/sources/calendar/feed-transport.ts';
import { normaliseFeedUrl } from '../src/sources/calendar/feed-url.ts';
import { expandCalendar } from '../src/sources/calendar/ics-expand.ts';

const [settingsPath, credentialsPath] = process.argv.slice(2);
if (!settingsPath || !credentialsPath) {
  console.error('usage: calendar-live-check.mjs <settings.yaml> <credentials.yaml>');
  process.exit(2);
}
const settings = parse(readFileSync(settingsPath, 'utf8'));
const credentials = parse(readFileSync(credentialsPath, 'utf8')) ?? {};
const calendar = settings.sources?.calendar;
if (!calendar) {
  console.error('sources.calendar is missing in settings.yaml');
  process.exit(2);
}

const transport = createFeedTransport();
let failed = false;
for (const [id, entry] of Object.entries(calendar.calendars)) {
  if (!entry.enabled) {
    console.log(`skip ${id}: disabled`);
    continue;
  }
  const started = Date.now();
  try {
    const url = normaliseFeedUrl(credentials[`calendar-${id}`]?.url ?? '');
    const response = await transport(url, {
      signal: AbortSignal.timeout(20_000),
      userAgent: 'home-dashboard/live-check',
      maxBytes: 8_000_000,
    });
    const text = response.text ?? '';
    const payload = expandCalendar(text, {
      now: new Date(),
      timezone: settings.timezone,
      selfAddresses: entry.selfAddresses ?? [],
    });
    const recurring = (text.match(/^RRULE/gm) ?? []).length;
    console.log(
      `ok ${id}: ${Math.round(text.length / 1024)} KiB, ${(text.match(/^BEGIN:VEVENT/gm) ?? []).length} events in the feed ` +
        `(${recurring} recurring), ${payload.events.length} in the window ` +
        `(${payload.events.filter((event) => event.allDay).length} all-day), truncated=${payload.truncated}, ${Date.now() - started} ms`,
    );
  } catch (error) {
    failed = true;
    console.log(`FAIL ${id}: ${error?.reason ?? 'unexpected error'}`);
  }
}
process.exit(failed ? 1 : 0);
