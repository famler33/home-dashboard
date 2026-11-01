import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Source {
  id: string;
  status: string;
  data: unknown;
  lastUpdated: string | null;
  ageSeconds: number | null;
  staleAfterSeconds: number;
  lastErrorCode: string | null;
}
interface Event {
  uid: string;
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  tentative: boolean;
}

const golden = JSON.parse(
  readFileSync(
    join(process.cwd(), '../backend/test/fixtures/calendar/calendar.snapshot.sample.json'),
    'utf8',
  ),
) as {
  settings: { calendar: unknown; timezone: string; display: unknown };
  sources: Source[];
  serverTime: string;
};

/** The golden snapshot was recorded at this instant; the Playwright clock is set to it. */
export const calendarInstant = new Date(golden.serverTime);

export interface CalendarMock {
  /** Replace the events of a calendar source. */
  events?: Partial<Record<'calendar-family' | 'calendar-person-1', Event[]>>;
  status?: Partial<Record<'calendar-family' | 'calendar-person-1', string>>;
  /** Server time of the snapshot; defaults to the recorded instant. */
  serverTime?: string;
}

export function ev(
  title: string,
  startUtc: string,
  endUtc: string,
  extra: Partial<Event> = {},
): Event {
  return {
    uid: `${title}@e2e`,
    title,
    allDay: false,
    start: `${startUtc}:00.000Z`,
    end: `${endUtc}:00.000Z`,
    tentative: false,
    ...extra,
  };
}

export function calendarSnapshotBody(options: CalendarMock = {}) {
  const sources = JSON.parse(JSON.stringify(golden.sources)) as Source[];
  for (const [id, events] of Object.entries(options.events ?? {})) {
    sources.find((source) => source.id === id)!.data = { events, truncated: false };
  }
  for (const [id, status] of Object.entries(options.status ?? {})) {
    const source = sources.find((candidate) => candidate.id === id)!;
    source.status = status;
    if (status === 'stale') source.ageSeconds = 2400;
    if (status === 'error' || status === 'never-loaded') {
      source.data = null;
      source.ageSeconds = null;
      source.lastUpdated = null;
    }
  }
  return {
    buildId: 'e2e',
    serverTime: options.serverTime ?? golden.serverTime,
    settings: golden.settings,
    sources,
  };
}

/** Many long appointments today, two Kita entries and a stale work calendar. */
export function worstCase(): CalendarMock {
  const family: Event[] = [
    ev('Kita holen – Alex und Ben mit sehr langem Titel', '2026-10-28T14:30', '2026-10-28T15:00'),
    ev(
      'Kita bringen – Ben mit noch längerem Titel für den Test',
      '2026-10-29T07:00',
      '2026-10-29T07:30',
    ),
  ];
  const work: Event[] = [];
  for (let hour = 11; hour < 19; hour += 1) {
    const start = `2026-10-28T${hour}:00`;
    const end = `2026-10-28T${hour}:45`;
    family.push(
      ev(`Familientermin ${hour} Uhr mit einem sehr sehr langen Titel zum Kürzen`, start, end),
    );
    work.push(
      ev(`Arbeitstermin ${hour} Uhr mit einem sehr sehr langen Titel zum Kürzen`, start, end),
    );
  }
  family.push(
    ev('Urlaub bei Oma', '2026-10-30T00:00', '2026-11-01T00:00', {
      allDay: true,
      start: '2026-10-30',
      end: '2026-11-02',
    }),
  );
  return {
    events: { 'calendar-family': family, 'calendar-person-1': work },
    status: { 'calendar-person-1': 'stale' },
  };
}
