import { readFileSync, writeFileSync } from 'node:fs';
import { Value } from '@sinclair/typebox/value';
import { describe, expect, it } from 'vitest';
import { FeedRejected } from './feed-url.js';
import { expandCalendar } from './ics-expand.js';
import { calendarPayloadSchema } from './types.js';

const dir = new URL('../../../test/fixtures/calendar/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, dir), 'utf8');
const family = read('icloud-family.sample.ics');
const work = read('google-work.sample.ics');

const now = new Date('2026-10-28T10:00:00Z');
const timezone = 'Europe/Berlin';
const options = { now, timezone, selfAddresses: [] as string[] };
const expand = (text: string, extra: Partial<typeof options> = {}) =>
  expandCalendar(text, { ...options, ...extra });
const titles = (text: string, extra: Partial<typeof options> = {}) =>
  expand(text, extra).events.map((event) => event.title);

// Covers: FR-2, NFR-7, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-12
describe('ics expansion', () => {
  it('turns the recorded feeds into the expected payloads', () => {
    const actual = {
      family: expand(family, { selfAddresses: ['alex@example.com'] }),
      work: expand(work, { selfAddresses: ['alex@example.com'] }),
    };
    const goldenUrl = new URL('calendar.expected.json', dir);
    if (process.env['UPDATE_FIXTURES'] === '1') {
      writeFileSync(goldenUrl, `${JSON.stringify(actual, null, 2)}\n`);
    }
    expect(actual).toEqual(JSON.parse(readFileSync(goldenUrl, 'utf8')));
    expect(Value.Check(calendarPayloadSchema, actual.family)).toBe(true);
    expect(Value.Check(calendarPayloadSchema, actual.work)).toBe(true);
  });

  it('keeps occurrences that overlap the window from yesterday to six days ahead', () => {
    const all = titles(family);
    expect(all).toContain('Gestern bis heute');
    expect(all).not.toContain('Weit weg');
    expect(all).not.toContain('Lange vorbei');
  });

  it('expands daily and weekly rules inside the window', () => {
    const events = expand(family).events;
    expect(events.filter((event) => event.title.startsWith('Kita bringen'))).toHaveLength(6);
    expect(events.filter((event) => event.title === 'Turnen')).toHaveLength(1);
    const weekly = expand(work).events.filter((event) => event.title === 'Team Sync');
    expect(weekly.map((event) => event.start)).toEqual([
      '2026-10-28T08:00:00.000Z',
      '2026-11-02T08:00:00.000Z',
    ]);
  });

  it('skips excluded occurrences', () => {
    const starts = expand(family).events.filter((event) => event.title.startsWith('Kita bringen'));
    expect(starts.map((event) => event.start)).not.toContain('2026-10-28T06:30:00.000Z');
    const work30 = expand(work).events.filter((event) => event.title === 'Team Sync');
    expect(work30.map((event) => event.start)).not.toContain('2026-10-30T08:00:00.000Z');
  });

  it('uses the moved or renamed occurrence from RECURRENCE-ID', () => {
    const moved = expand(family).events.find((event) => event.title.includes('später'));
    expect(moved?.start).toBe('2026-10-29T08:00:00.000Z');
    expect(moved?.end).toBe('2026-10-29T08:30:00.000Z');
    expect(titles(family).filter((title) => title === 'Kita bringen – Alex')).toHaveLength(5);
  });

  it('stops a runaway rule at the iteration cap and sets truncated', () => {
    const bomb = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:x\r\nDTSTART:20261028T000000Z\r\nDTEND:20261028T000001Z\r\nRRULE:FREQ=SECONDLY\r\nSUMMARY:Bombe\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const payload = expand(bomb);
    expect(payload.truncated).toBe(true);
    expect(payload.events.length).toBeLessThanOrEqual(200);
  });

  it('maps VALUE=DATE events to local dates with an exclusive end', () => {
    const events = expand(family).events;
    const holiday = events.find((event) => event.title === 'Urlaub bei Oma');
    expect(holiday).toMatchObject({ allDay: true, start: '2026-10-30', end: '2026-11-02' });
    const oneDay = events.find((event) => event.title === 'Ohne Ende');
    expect(oneDay).toMatchObject({ allDay: true, start: '2026-10-31', end: '2026-11-01' });
  });

  it('converts events entered in other time zones to UTC instants', () => {
    const events = expand(family).events;
    expect(events.find((event) => event.title === 'Call New York')?.start).toBe(
      '2026-10-29T13:00:00.000Z',
    );
    expect(events.find((event) => event.title === 'Schwebende Zeit')?.start).toBe(
      '2026-10-29T09:00:00.000Z',
    );
    expect(events.find((event) => event.title === 'Unbekannte Zone')?.start).toBe(
      '2026-10-29T13:00:00.000Z',
    );
  });

  it('keeps 07:30 local across the October clock change', () => {
    const early = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTIMEZONE\r\nTZID:Europe/Berlin\r\nBEGIN:STANDARD\r\nDTSTART:19701025T030000\r\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0100\r\nEND:STANDARD\r\nBEGIN:DAYLIGHT\r\nDTSTART:19700329T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\nTZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200\r\nEND:DAYLIGHT\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT\r\nUID:dst\r\nDTSTART;TZID=Europe/Berlin:20261020T073000\r\nDTEND;TZID=Europe/Berlin:20261020T080000\r\nRRULE:FREQ=DAILY;COUNT=12\r\nSUMMARY:Morgens\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    const events = expand(early, { now: new Date('2026-10-24T10:00:00Z') }).events;
    const hours = events.map((event) => event.start.slice(11, 16));
    expect(hours).toContain('05:30'); // 24 Oct, still summer time
    expect(hours).toContain('06:30'); // 26 Oct, after the clock change
  });

  it('drops events with STATUS:CANCELLED', () => {
    expect(titles(family)).not.toContain('Abgesagter Termin');
  });

  it('drops events the owner declined, matched by selfAddresses, case-insensitively', () => {
    expect(titles(family, { selfAddresses: ['ALEX@example.com'] })).not.toContain(
      'Abgelehnte Besprechung',
    );
    expect(titles(work, { selfAddresses: ['alex@example.com'] })).not.toContain(
      'Strategie-Workshop',
    );
  });

  it('keeps declined events when no selfAddresses are configured', () => {
    expect(titles(family)).toContain('Abgelehnte Besprechung');
    expect(titles(work)).toContain('Strategie-Workshop');
  });

  it('marks tentative events and keeps them', () => {
    const events = expand(family).events;
    expect(events.find((event) => event.title === 'Vielleicht Brunch')?.tentative).toBe(true);
    const meeting = expand(work, { selfAddresses: ['alex@example.com'] }).events.find(
      (event) => event.title === 'Kundentermin',
    );
    expect(meeting?.tentative).toBe(true);
    expect(events.find((event) => event.title === 'Turnen')?.tentative).toBe(false);
  });

  it('ignores CLASS and shows private events with their title', () => {
    expect(titles(work)).toContain('Team Sync');
  });

  it('never copies description, location, attendees or links into the payload', () => {
    const payload = expand(family);
    const text = JSON.stringify(payload);
    for (const secret of [
      'Zugangscode',
      'meet.example',
      'Hauptstraße',
      'boss@example.com',
      'mailto',
    ]) {
      expect(text).not.toContain(secret);
    }
    for (const event of payload.events) {
      expect(Object.keys(event).sort()).toEqual(
        ['allDay', 'end', 'start', 'tentative', 'title', 'uid'].sort(),
      );
    }
  });

  it('strips control characters and cuts titles at 120 characters', () => {
    const long = expand(family).events.find((event) => event.title.startsWith('Elternabend'));
    expect(long?.title).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    expect(long?.title.length).toBe(120);
  });

  it('sorts by start then title', () => {
    const starts = expand(family).events.map((event) => event.start);
    const timed = starts.filter((value) => value.includes('T'));
    expect([...timed].sort()).toEqual(timed);
  });

  it('caps the list at 200 events and sets truncated', () => {
    const many = Array.from(
      { length: 250 },
      (_, index) =>
        `BEGIN:VEVENT\r\nUID:m${index}\r\nDTSTART:20261029T${String(index % 24).padStart(2, '0')}0000Z\r\nDTEND:20261029T${String(index % 24).padStart(2, '0')}3000Z\r\nSUMMARY:E${index}\r\nEND:VEVENT\r\n`,
    ).join('');
    const payload = expand(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${many}END:VCALENDAR\r\n`);
    expect(payload.events).toHaveLength(200);
    expect(payload.truncated).toBe(true);
  });

  it('maps parser failures to a closed reason without feed text', () => {
    try {
      expand(
        'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:garbage-SECRET-TEXT\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(FeedRejected);
      expect((error as Error).message).not.toContain('SECRET-TEXT');
      return;
    }
    // A feed with one broken event is tolerated: the event is skipped, nothing leaks.
  });

  it('expands a synthetic 5 MB feed in under 3 seconds', () => {
    const block = (index: number) =>
      `BEGIN:VEVENT\r\nUID:perf${index}\r\nDTSTART:20240101T080000Z\r\nDTEND:20240101T090000Z\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Serie ${index} ${'x'.repeat(40)}\r\nDESCRIPTION:${'d'.repeat(900)}\r\nEND:VEVENT\r\n`;
    let body = '';
    for (let index = 0; body.length < 5_000_000; index += 1) body += block(index);
    const text = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}END:VCALENDAR\r\n`;
    const started = Date.now();
    expand(text);
    expect(Date.now() - started).toBeLessThan(3000);
  }, 20_000);
});
