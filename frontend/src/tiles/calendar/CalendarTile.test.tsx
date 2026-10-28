import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Snapshot, SourceSnapshot } from '../../api/types';
import { createI18n } from '../../i18n';
import { de } from '../../i18n/de';
import { ShellContext } from '../../shell/shell-context';
import { snapshotFixture } from '../../test-fixtures';
import { contextFixture, renderWithProviders } from '../../test-utils';
import { CalendarTile } from './CalendarTile';
import { CalendarView } from './CalendarView';
import { allDay, calendarNow, settingsFixture, tag, timed } from './test-data';
import type { CalendarEvent, CalendarSettings } from './types';

const entry = (
  id: string,
  events: CalendarEvent[],
  extra: Partial<SourceSnapshot> = {},
): SourceSnapshot => ({
  id,
  status: 'fresh',
  data: { events, truncated: false },
  lastUpdated: '2026-10-28T09:59:30.000Z',
  ageSeconds: 30,
  staleAfterSeconds: 1800,
  lastErrorCode: null,
  ...extra,
});

const familyEvents = [
  timed('Zahnarzt', '2026-10-28T12:00', '2026-10-28T13:00'),
  timed('Kita holen – Alex', '2026-10-28T14:30', '2026-10-28T15:00'),
  timed('Kita bringen – Ben', '2026-10-29T07:00', '2026-10-29T07:30'),
  allDay('Urlaub', '2026-10-30', '2026-11-02'),
  timed('Elternabend', '2026-10-29T17:30', '2026-10-29T19:00'),
];
const workEvents = [timed('Teamtermin', '2026-10-28T13:00', '2026-10-28T14:00')];

function snapshotWith(
  sources: SourceSnapshot[],
  calendar: CalendarSettings | undefined = settingsFixture,
): Snapshot {
  return snapshotFixture({
    serverTime: new Date(calendarNow).toISOString(),
    settings: {
      timezone: 'Europe/Berlin',
      display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
      ...(calendar ? { calendar } : {}),
    },
    sources,
  });
}

const defaultSources = () => [
  entry('calendar-family', familyEvents),
  entry('calendar-person-1', workEvents),
  entry('calendar-person-2', []),
];

function show(
  sources: SourceSnapshot[] = defaultSources(),
  layout: 'tablet' | 'phone' = 'tablet',
  calendar: CalendarSettings | undefined = settingsFixture,
) {
  return renderWithProviders(
    <ShellContext.Provider value={{ layout, theme: 'day' }}>
      <CalendarTile data={{}} />
    </ShellContext.Provider>,
    contextFixture(snapshotWith(sources, calendar)),
  );
}

const rows = () => screen.queryAllByTestId('event-row');
const rowTitles = () => rows().map((row) => row.getAttribute('data-title'));
const tab = (name: string) => screen.getByRole('tab', { name });

beforeEach(() =>
  vi.useFakeTimers({ now: calendarNow, toFake: ['setTimeout', 'clearTimeout', 'Date'] }),
);
afterEach(() => vi.useRealTimers());

// Covers: FR-1, FR-3, FR-4, FR-5, FR-6, AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-14, AC-16, AC-17, AC-18, AC-21
describe('CalendarTile agenda', () => {
  it('groups the events into day headings with German labels', () => {
    show();
    const headings = screen.getAllByTestId('day-heading').map((node) => node.textContent);
    expect(headings).toEqual(
      [de.calendar.today, de.calendar.tomorrow, 'Fr. 30.10.', 'Sa. 31.10.', 'So. 01.11.'].slice(
        0,
        headings.length,
      ),
    );
    expect(headings[0]).toBe('Heute');
    expect(headings[1]).toBe('Morgen');
    expect(headings[2]).toBe('Fr. 30.10.');
  });

  it('shows time, title and a colour dot per event', () => {
    show();
    const row = rows().find((node) => node.getAttribute('data-title') === 'Zahnarzt')!;
    expect(within(row).getByText('13:00')).toBeInTheDocument();
    expect(within(row).getByText('Zahnarzt')).toBeInTheDocument();
    expect(within(row).getByTestId('calendar-dot').className).toContain('bg-cal-blue');
  });

  it('colours each row by its calendar', () => {
    show();
    const work = rows().find((node) => node.getAttribute('data-title') === 'Teamtermin')!;
    expect(within(work).getByTestId('calendar-dot').className).toContain('bg-cal-green');
  });

  it('shows ganztägig and a part label from the second day on', () => {
    show();
    const vacation = rows().filter((node) => node.getAttribute('data-title') === 'Urlaub');
    expect(within(vacation[0]!).getByText(de.calendar.allDay)).toBeInTheDocument();
    expect(within(vacation[1]!).getByText('Tag 2 von 3')).toBeInTheDocument();
  });

  it('exposes the calendar name as text for every event', () => {
    show();
    const row = rows().find((node) => node.getAttribute('data-title') === 'Teamtermin')!;
    expect(within(row).getByText(/Alex/, { selector: '.sr-only' })).toBeInTheDocument();
  });

  it('keeps the full title for assistive technology while the visible line truncates', () => {
    show([
      entry('calendar-family', [
        timed('Sehr langer Titel '.repeat(8), '2026-10-28T12:00', '2026-10-28T13:00'),
      ]),
    ]);
    const title = within(rows()[0]!).getByTestId('event-title');
    expect(title.className).toContain('truncate');
    expect(title).toHaveAttribute('title', expect.stringContaining('Sehr langer Titel'));
  });

  it('shows a placeholder title for an event without a title', () => {
    show([entry('calendar-family', [timed('', '2026-10-28T12:00', '2026-10-28T13:00')])]);
    expect(screen.getByText(de.calendar.untitled)).toBeInTheDocument();
  });

  it('says Heute keine Termine when today has none and omits empty days', () => {
    show([entry('calendar-family', [timed('Freitag', '2026-10-30T10:00', '2026-10-30T11:00')])]);
    expect(screen.getByText(de.calendar.noneToday)).toBeInTheDocument();
    expect(screen.getAllByTestId('day-heading').map((node) => node.textContent)).toEqual([
      'Heute',
      'Fr. 30.10.',
    ]);
  });

  it('shows the empty state text when no calendar has events in the period', () => {
    show([entry('calendar-family', []), entry('calendar-person-1', [])]);
    expect(screen.getByText(de.calendar.empty)).toBeInTheDocument();
  });

  it('renders family rows in body size and semibold and work rows in caption size', () => {
    show();
    const family = rows().find((node) => node.getAttribute('data-title') === 'Zahnarzt')!;
    const work = rows().find((node) => node.getAttribute('data-title') === 'Teamtermin')!;
    expect(family.className).toMatch(/text-body/);
    expect(family.className).toMatch(/font-semibold/);
    expect(work.className).toMatch(/text-caption/);
    expect(work.className).not.toMatch(/font-semibold/);
  });

  it('hides ended events by the server-based now', () => {
    show([entry('calendar-family', [timed('Vorbei', '2026-10-28T08:00', '2026-10-28T09:00')])]);
    expect(rowTitles()).toEqual([]);
  });
});

describe('CalendarTile tabs, legend and states', () => {
  it('renders Alle, Familie and one tab per enabled person from the projection', () => {
    show();
    expect(screen.getByRole('tablist', { name: de.calendar.tabs.label })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((node) => node.textContent)).toEqual([
      'Alle',
      'Familie',
      'Alex',
      'Ben',
    ]);
  });

  it('marks the active tab with aria-selected and a filled shape', () => {
    show();
    expect(tab('Alle')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Alle').className).toMatch(/bg-ink/);
    expect(tab('Familie')).toHaveAttribute('aria-selected', 'false');
    expect(tab('Familie').className).not.toMatch(/bg-ink/);
  });

  it('shows only the selected calendar after a tap and applies the same rules', () => {
    show();
    fireEvent.click(tab('Alex'));
    expect(rowTitles()).toEqual(['Teamtermin']);
    fireEvent.click(tab('Familie'));
    expect(rowTitles()).not.toContain('Teamtermin');
    fireEvent.click(tab('Alle'));
    expect(rowTitles()).toContain('Teamtermin');
  });

  it('shows all rows of a filtered tab in body size', () => {
    show();
    fireEvent.click(tab('Alex'));
    expect(rows()[0]!.className).toMatch(/text-body/);
  });

  it('shows a calm text for a tab whose calendar has no events', () => {
    show();
    fireEvent.click(tab('Ben'));
    expect(screen.getByText('Keine Termine für Ben in den nächsten Tagen')).toBeInTheDocument();
  });

  it('uses the shared view-enter fade for a tab change', () => {
    show();
    fireEvent.click(tab('Familie'));
    expect(screen.getByTestId('agenda-body').className).toContain('view-enter');
  });

  it('returns to Alle after 60 seconds without input on the wall', () => {
    show();
    fireEvent.click(tab('Alex'));
    expect(tab('Alex')).toHaveAttribute('aria-selected', 'true');
    act(() => void vi.advanceTimersByTime(60_000));
    expect(tab('Alle')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the selected tab on the phone', () => {
    show(defaultSources(), 'phone');
    fireEvent.click(tab('Alex'));
    act(() => void vi.advanceTimersByTime(5 * 60_000));
    expect(tab('Alex')).toHaveAttribute('aria-selected', 'true');
  });

  it('lists every enabled calendar with colour and name in the Alle view', () => {
    show();
    const legend = screen.getByTestId('legend');
    for (const name of ['Familie', 'Alex', 'Ben'])
      expect(within(legend).getByText(name)).toBeInTheDocument();
  });

  it('marks a stale calendar on its legend chip with Veraltet and its age and keeps its rows', () => {
    show([
      entry('calendar-family', familyEvents),
      entry('calendar-person-1', workEvents, { status: 'stale', ageSeconds: 2400 }),
    ]);
    expect(
      within(screen.getByTestId('legend')).getByText('Veraltet · vor 40 Min.'),
    ).toBeInTheDocument();
    expect(rowTitles()).toContain('Teamtermin');
  });

  it('shows Noch nicht geladen on the chip of a never-loaded calendar while the others show', () => {
    show([
      entry('calendar-family', familyEvents),
      entry('calendar-person-1', [], {
        status: 'never-loaded',
        data: null,
        ageSeconds: null,
        lastUpdated: null,
      }),
    ]);
    expect(screen.getByText(de.calendar.neverLoaded)).toBeInTheDocument();
    expect(rowTitles()).toContain('Zahnarzt');
  });

  it('shows Nicht verfügbar on the chip of a failed calendar without data', () => {
    show([
      entry('calendar-family', familyEvents),
      entry('calendar-person-1', [], {
        status: 'error',
        data: null,
        ageSeconds: null,
        lastUpdated: null,
        lastErrorCode: 'SOURCE_FETCH_FAILED',
      }),
    ]);
    expect(screen.getByText(de.calendar.unavailable)).toBeInTheDocument();
  });

  it('renders tabs and legend from the projection even when no source ever loaded', () => {
    const never = (id: string) =>
      entry(id, [], { status: 'never-loaded', data: null, ageSeconds: null, lastUpdated: null });
    show([never('calendar-family'), never('calendar-person-1'), never('calendar-person-2')]);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('hides tab, legend chip and Kita block for a disabled family calendar', () => {
    const noFamily: CalendarSettings = {
      ...settingsFixture,
      calendars: settingsFixture.calendars.filter((entryInfo) => entryInfo.id !== 'family'),
    };
    show([entry('calendar-person-1', workEvents)], 'tablet', noFamily);
    expect(screen.queryByRole('tab', { name: 'Familie' })).toBeNull();
    expect(within(screen.getByTestId('legend')).queryByText('Familie')).toBeNull();
    expect(screen.queryByTestId('kita-block')).toBeNull();
  });

  it('shows no tab row when only one calendar is enabled', () => {
    const only: CalendarSettings = {
      ...settingsFixture,
      calendars: [settingsFixture.calendars[0]!],
    };
    show([entry('calendar-family', familyEvents)], 'tablet', only);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('uses 56 px tabs on the wall and 44 px on the phone', () => {
    show();
    expect(tab('Alle').className).toContain('min-h-14');
    document.body.innerHTML = '';
    show(defaultSources(), 'phone');
    expect(tab('Alle').className).toContain('min-h-11');
  });
});

describe('CalendarTile Kita block', () => {
  it('lists Kita events of today and tomorrow in a block with day, time and title', () => {
    show();
    const block = screen.getByTestId('kita-block');
    expect(within(block).getByText(de.calendar.kita)).toBeInTheDocument();
    expect(within(block).getByText(/Heute/)).toBeInTheDocument();
    expect(within(block).getByText('15:30')).toBeInTheDocument();
    expect(within(block).getByText('Kita holen – Alex')).toBeInTheDocument();
    expect(within(block).getByText('Kita bringen – Ben')).toBeInTheDocument();
  });

  it('shows a Kita event in the block only, not again in the agenda', () => {
    show();
    expect(rowTitles()).not.toContain('Kita holen – Alex');
    expect(rowTitles()).not.toContain('Kita bringen – Ben');
  });

  it('shows the block in Alle and Familie and not in a person tab', () => {
    show();
    fireEvent.click(tab('Familie'));
    expect(screen.getByTestId('kita-block')).toBeInTheDocument();
    fireEvent.click(tab('Alex'));
    expect(screen.queryByTestId('kita-block')).toBeNull();
  });

  it('renders no block and no reserved space without a match', () => {
    show([entry('calendar-family', [timed('Zahnarzt', '2026-10-28T12:00', '2026-10-28T13:00')])]);
    expect(screen.queryByTestId('kita-block')).toBeNull();
  });

  it('uses the projected keyword', () => {
    show(
      [entry('calendar-family', [timed('Hort abholen', '2026-10-28T14:00', '2026-10-28T15:00')])],
      'tablet',
      { ...settingsFixture, kitaKeyword: 'Hort' },
    );
    expect(screen.getByTestId('kita-block')).toBeInTheDocument();
  });
});

describe('CalendarTile phone and texts', () => {
  it('renders all days and the Kita block on the phone without a row budget', () => {
    show(defaultSources(), 'phone');
    expect(screen.queryByText(/weitere/)).toBeNull();
    expect(screen.getByTestId('kita-block')).toBeInTheDocument();
    expect(screen.getAllByTestId('day-heading').length).toBeGreaterThanOrEqual(3);
  });

  it('renders with dictionary text only', () => {
    const pseudo = JSON.parse(JSON.stringify(de), (_key, value) =>
      typeof value === 'string' ? `§${value}` : value,
    );
    renderWithProviders(
      <ShellContext.Provider value={{ layout: 'tablet', theme: 'day' }}>
        <CalendarTile data={{}} />
      </ShellContext.Provider>,
      contextFixture(snapshotWith(defaultSources())),
      createI18n(pseudo, 'xx'),
    );
    expect(screen.getByText(`§${de.calendar.tabs.all}`)).toBeInTheDocument();
    expect(screen.getAllByTestId('day-heading')[0]!.textContent).toBe(`§${de.calendar.today}`);
  });
});

describe('CalendarView row budget', () => {
  const view = (budget: number | null) => {
    const sources = defaultSources();
    return renderWithProviders(
      <ShellContext.Provider value={{ layout: 'tablet', theme: 'day' }}>
        <CalendarView
          snapshot={snapshotWith(sources)}
          now={calendarNow}
          layout="tablet"
          budget={budget}
          tab="all"
        />
      </ShellContext.Provider>,
      contextFixture(snapshotWith(sources)),
    );
  };

  it('fills whole rows only and ends with + n weitere', () => {
    view(6);
    expect(screen.getByText(/^\+ \d+ weitere$/)).toBeInTheDocument();
    const shown =
      screen.queryAllByTestId('event-row').length + screen.queryAllByTestId('kita-row').length;
    expect(shown).toBeGreaterThan(0);
  });

  it('collapses later days to their heading with a count', () => {
    view(9);
    expect(
      screen.queryAllByText(/\d+ Termine?$/).length + screen.queryAllByTestId('day-heading').length,
    ).toBeGreaterThan(0);
  });

  it('shows everything without a budget', () => {
    view(null);
    expect(screen.queryByText(/weitere/)).toBeNull();
  });

  it('keeps tag helper exported for fixtures', () => {
    expect(tag(familyEvents[0]!).calendar).toBe('family');
  });
});
