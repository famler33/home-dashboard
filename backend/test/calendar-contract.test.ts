import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { createSnapshotStore } from '../src/cache/snapshot-store.js';
import { migrationsDir } from '../src/db/database.js';
import { runMigrations } from '../src/db/migrate.js';
import { buildSnapshot } from '../src/snapshot/build-snapshot.js';
import { snapshotSchema } from '../src/snapshot/schema.js';
import { createCalendarSource } from '../src/sources/calendar/calendar-source.js';
import { normaliseFeedUrl } from '../src/sources/calendar/feed-url.js';
import { calendarPayloadSchema } from '../src/sources/calendar/types.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/calendar/${name}`, import.meta.url), 'utf8');
const goldenPath = fileURLToPath(
  new URL('./fixtures/calendar/calendar.snapshot.sample.json', import.meta.url),
);
const now = Date.parse('2026-10-28T10:00:00Z');
const signal = new AbortController().signal;

// Covers: FR-7, NFR-7, AC-15, AC-28 (contract with the frontend)
describe('calendar snapshot contract', () => {
  it('builds the golden snapshot from the recorded feeds and matches the schemas', async () => {
    const make = (id: 'calendar-family' | 'calendar-person-1', host: string, text: string) =>
      createCalendarSource({
        id,
        url: normaliseFeedUrl(`https://${host}/x`),
        timezone: 'Europe/Berlin',
        selfAddresses: ['alex@example.com'],
        transport: async () => ({ status: 200, text }),
        userAgent: 'home-dashboard/test',
        now: () => new Date(now),
      });
    const family = make(
      'calendar-family',
      'p12-caldav.icloud.com',
      fixture('icloud-family.sample.ics'),
    );
    const work = make(
      'calendar-person-1',
      'calendar.google.com',
      fixture('google-work.sample.ics'),
    );
    const payloads = {
      'calendar-family': await family.fetch(signal),
      'calendar-person-1': await work.fetch(signal),
    };
    for (const payload of Object.values(payloads)) {
      expect(Value.Check(calendarPayloadSchema, payload)).toBe(true);
    }

    const db = new Database(':memory:');
    runMigrations(db, migrationsDir);
    const store = createSnapshotStore(db);
    for (const [id, payload] of Object.entries(payloads))
      store.recordSuccess(id, payload, now - 30_000);
    const snapshot = buildSnapshot({
      sources: [family, work],
      store,
      settings: {
        timezone: 'Europe/Berlin',
        display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
        calendar: {
          kitaKeyword: 'Kita',
          calendars: [
            { id: 'family', name: 'Familie', color: 'blue', role: 'family' },
            { id: 'person-1', name: 'Alex', color: 'green', role: 'person' },
          ],
        },
      },
      buildId: 'sample',
      now,
    });
    expect(Value.Check(snapshotSchema, snapshot)).toBe(true);

    if (process.env['UPDATE_FIXTURES'] === '1')
      writeFileSync(goldenPath, `${JSON.stringify(snapshot)}\n`);
    expect(snapshot).toEqual(JSON.parse(readFileSync(goldenPath, 'utf8')));
  });
});
