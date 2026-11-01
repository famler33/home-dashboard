import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import golden from '../../../../backend/test/fixtures/lists/lists.state.sample.json';
import snapshotJson from '../../../../backend/test/fixtures/lists/lists.snapshot.sample.json';
import type { ListsState } from '../../api/lists-types';
import type { Snapshot } from '../../api/types';
import { createI18n, i18n } from '../../i18n';
import { de } from '../../i18n/de';
import { ListsProvider } from '../../lists/ListsProvider';
import { DetailContext } from '../../shell/detail-context';
import { ShellContext } from '../../shell/shell-context';
import { SnapshotContext } from '../../snapshot/snapshot-context';
import { contextFixture } from '../../test-utils';
import { Tile } from '../Tile';
import { tileRegistry } from '../registry';
import { ListsTile } from './ListsTile';

const state = golden as unknown as ListsState;
const snapshot = snapshotJson as unknown as Snapshot;

function snapshotWith(change: (data: Record<string, unknown>) => void): Snapshot {
  const copy = JSON.parse(JSON.stringify(snapshot)) as Snapshot;
  change(copy.sources.find((source) => source.id === 'lists')!.data as Record<string, unknown>);
  return copy;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function show(
  options: {
    snap?: Snapshot;
    layout?: 'tablet' | 'phone';
    fetchImpl?: typeof fetch;
    budget?: number | null;
    open?: (id: string) => void;
    instance?: typeof i18n;
  } = {},
) {
  const fetchImpl =
    options.fetchImpl ?? (vi.fn(async () => json(state)) as unknown as typeof fetch);
  const detail = { open: options.open ?? vi.fn() };
  return {
    fetchImpl,
    ...render(
      <I18nextProvider i18n={options.instance ?? i18n}>
        <SnapshotContext.Provider value={contextFixture(options.snap ?? snapshot)}>
          <ShellContext.Provider value={{ layout: options.layout ?? 'tablet', theme: 'day' }}>
            <DetailContext.Provider value={detail}>
              <ListsProvider fetchImpl={fetchImpl}>
                <ListsTile {...(options.budget !== undefined ? { budget: options.budget } : {})} />
              </ListsProvider>
            </DetailContext.Provider>
          </ShellContext.Provider>
        </SnapshotContext.Provider>
      </I18nextProvider>,
    ),
  };
}

const flush = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
};
const tap = (element: Element, downMs = 120, move = 0) => {
  fireEvent.pointerDown(element, { clientX: 10, clientY: 10, pointerId: 1, isPrimary: true });
  act(() => void vi.advanceTimersByTime(downMs));
  fireEvent.pointerUp(element, { clientX: 10 + move, clientY: 10, pointerId: 1, isPrimary: true });
};
const column = (name: string) => screen.getByRole('region', { name });

beforeEach(() =>
  vi.useFakeTimers({
    now: Date.parse('2026-10-28T10:30:00Z'),
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  }),
);
afterEach(() => vi.useRealTimers());

// Covers: FR-2, FR-3, FR-5, NFR-2, NFR-5, AC-7, AC-8, AC-9, AC-10, AC-11, AC-14, AC-16, AC-19, AC-25, AC-29, AC-36, AC-39, AC-45
describe('ListsTile on the wall', () => {
  it('shows Einkauf on the left and To-dos on the right with the open counts in the headings', () => {
    show();
    const shopping = column(de.lists.shopping);
    const todos = column(de.lists.todos);
    expect(within(shopping).getByText('1')).toBeInTheDocument();
    expect(within(todos).getByText('3')).toBeInTheDocument();
    expect(shopping.compareDocumentPosition(todos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lists open entries before checked ones, with checked ones dimmed, crossed out and with a check icon', () => {
    show();
    const rows = within(column(de.lists.shopping)).getAllByTestId('list-row');
    expect(rows.map((row) => row.getAttribute('data-title'))).toEqual(['Eier', 'Brot']);
    const checked = rows[1]!;
    expect(checked.className).toMatch(/opacity/);
    expect(within(checked).getByTestId('row-title').className).toMatch(/line-through/);
    expect(within(checked).getByTestId('check-icon')).toBeInTheDocument();
    expect(within(rows[0]!).queryByTestId('check-icon')).toBeNull();
  });

  it('shows priority mark, title and category for a to-do and no effort or prerequisite', () => {
    show();
    const rows = within(column(de.lists.todos)).getAllByTestId('list-row');
    expect(rows.map((row) => row.getAttribute('data-title'))).toEqual([
      'Verkabelung Schreibtisch',
      'Lichtsituation planen',
      'Pflanze leiten',
    ]);
    expect(within(rows[0]!).getByText('Büro')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Wohnzimmer')).toBeInTheDocument();
    expect(screen.queryByText(/Lampen kaufen/)).toBeNull();
    expect(within(rows[0]!).queryByText(/Std/)).toBeNull();
  });

  it('uses a distinct icon and an sr-only text per priority level', () => {
    show();
    const rows = within(column(de.lists.todos)).getAllByTestId('list-row');
    const marks = rows.map((row) => within(row).getByTestId('priority-mark'));
    expect(marks.map((mark) => mark.getAttribute('data-level'))).toEqual(['high', 'medium', 'low']);
    expect(
      new Set(
        marks.map((mark) => mark.querySelector('svg')?.getAttribute('data-icon') ?? mark.innerHTML),
      ).size,
    ).toBe(3);
    expect(within(rows[0]!).getByText(de.lists.priority.high)).toHaveClass('sr-only');
    expect(within(rows[2]!).getByText(de.lists.priority.low)).toHaveClass('sr-only');
  });

  it('keeps the full title for assistive technology while the visible line truncates', () => {
    const long = 'Sehr langer Titel '.repeat(5).trim();
    show({
      snap: snapshotWith((data) => {
        (data['shopping'] as { title: string }[])[0]!.title = long;
      }),
    });
    const title = within(column(de.lists.shopping)).getAllByTestId('row-title')[0]!;
    expect(title.className).toContain('truncate');
    expect(title).toHaveAttribute('title', long);
  });

  it('says Nichts zu kaufen and Keine offenen To-dos for empty lists and Alles erledigt when only checked entries remain', () => {
    show({
      snap: snapshotWith((data) => {
        data['shopping'] = [];
        data['todos'] = [];
        data['counts'] = { shoppingOpen: 0, todoOpen: 0, todoHigh: 0 };
      }),
    });
    expect(screen.getByText(de.lists.emptyShopping)).toBeInTheDocument();
    expect(screen.getByText(de.lists.emptyTodos)).toBeInTheDocument();
  });

  it('shows Alles erledigt when only checked entries are left', () => {
    show({
      snap: snapshotWith((data) => {
        (data['shopping'] as { checkedAt: string | null }[])[0]!.checkedAt =
          '2026-10-28T10:00:00.000Z';
        data['counts'] = { shoppingOpen: 0, todoOpen: 3, todoHigh: 1 };
      }),
    });
    expect(within(column(de.lists.shopping)).getByText(de.lists.allDone)).toBeInTheDocument();
  });

  it('fills whole rows per column and counts the rest in + n weitere with the exact number', () => {
    show({ budget: 3 });
    // unit rows: heading 1 + more 1 leaves one row per column for the to-dos
    const todos = column(de.lists.todos);
    expect(within(todos).getAllByTestId('list-row')).toHaveLength(1);
    expect(within(todos).getByText('+ 2 weitere')).toBeInTheDocument();
    // the shopping column fits completely in three unit rows
    expect(within(column(de.lists.shopping)).queryByText(/weitere/)).toBeNull();
  });

  it('shows the highest priorities first when the tile is too small', () => {
    show({ budget: 3 });
    const rows = within(column(de.lists.todos)).getAllByTestId('list-row');
    expect(rows[0]).toHaveAttribute('data-title', 'Verkabelung Schreibtisch');
  });

  it('counts entries that are only in the counts, not in the summary rows', () => {
    show({
      snap: snapshotWith((data) => {
        data['counts'] = { shoppingOpen: 1, todoOpen: 30, todoHigh: 9 };
        data['truncated'] = true;
      }),
      budget: null,
    });
    expect(within(column(de.lists.todos)).getByText('+ 27 weitere')).toBeInTheDocument();
  });

  it('opens the detail view from + n weitere', () => {
    const open = vi.fn();
    show({ budget: 3, open });
    fireEvent.click(within(column(de.lists.todos)).getByText('+ 2 weitere'));
    expect(open).toHaveBeenCalledWith('lists-live', expect.anything());
  });
});

describe('ListsTile checking', () => {
  it('checks only through the 56 px circle and ignores taps on the title', async () => {
    const { fetchImpl } = show();
    const row = within(column(de.lists.shopping)).getAllByTestId('list-row')[0]!;
    tap(within(row).getByTestId('row-title'));
    await flush();
    expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled();
    const circle = within(row).getByRole('checkbox');
    expect(circle.className).toMatch(/min-h-14/);
    tap(circle);
    await flush();
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(String(url)).toBe(`/api/v1/lists/items/${state.shopping[0]!.id}`);
    expect(JSON.parse(String(init?.body))).toEqual({ checked: true });
  });

  it('ignores very short or moving taps', async () => {
    const { fetchImpl } = show();
    const circle = within(column(de.lists.shopping)).getAllByRole('checkbox')[0]!;
    tap(circle, 30);
    tap(circle, 150, 30);
    await flush();
    expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled();
  });

  it('toggles from the keyboard', async () => {
    const { fetchImpl } = show();
    fireEvent.click(within(column(de.lists.shopping)).getAllByRole('checkbox')[0]!);
    await flush();
    expect(vi.mocked(fetchImpl)).toHaveBeenCalledTimes(1);
  });

  it('shows Rückgängig for 8 seconds after checking and unchecks on tap', async () => {
    const { fetchImpl } = show();
    const shopping = () => column(de.lists.shopping);
    tap(within(shopping()).getAllByRole('checkbox')[0]!);
    await flush();
    const undo = within(shopping()).getByRole('button', { name: de.lists.undo });
    fireEvent.click(undo);
    await flush();
    const bodies = vi
      .mocked(fetchImpl)
      .mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toEqual([{ checked: true }, { checked: false }]);
    tap(within(shopping()).getAllByRole('checkbox')[0]!);
    await flush();
    expect(within(shopping()).getByRole('button', { name: de.lists.undo })).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(8_000));
    expect(within(shopping()).queryByRole('button', { name: de.lists.undo })).toBeNull();
  });
});

describe('ListsTile unsaved changes', () => {
  it('marks a pending change with a clock, a failed change as Nicht gespeichert and counts them in the heading', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    show({ fetchImpl });
    tap(within(column(de.lists.shopping)).getAllByRole('checkbox')[0]!);
    await flush();
    expect(within(column(de.lists.shopping)).getByText(de.lists.notSaved)).toBeInTheDocument();
    expect(screen.getByText('1 nicht gespeichert')).toBeInTheDocument();
  });
});

describe('ListsTile on the phone and in other variants', () => {
  it('shows a clear link to the list page, 44 px circles and no row budget on the phone', () => {
    show({ layout: 'phone' });
    const link = screen.getByRole('link', { name: de.lists.openPage });
    expect(link).toHaveAttribute('href', '/listen');
    expect(within(column(de.lists.shopping)).getAllByRole('checkbox')[0]!.className).toMatch(
      /min-h-11/,
    );
    expect(screen.queryByText(/weitere/)).toBeNull();
  });

  it('drops the category on short screens', () => {
    show();
    const category = within(column(de.lists.todos)).getByText('Büro');
    expect(category.className).toContain('tablet-short:hidden');
  });

  it('renders with dictionary text only', () => {
    const pseudo = JSON.parse(JSON.stringify(de), (_key, value) =>
      typeof value === 'string' ? `§${value}` : value,
    );
    show({ instance: createI18n(pseudo, 'xx') });
    expect(screen.getByRole('region', { name: `§${de.lists.shopping}` })).toBeInTheDocument();
  });
});

// Covers: AC-13
describe('ListsTile states', () => {
  const definition = tileRegistry.find((entry) => entry.id === 'lists-live')!;
  const withStatus = (status: 'never-loaded' | 'error'): Snapshot => {
    const copy = JSON.parse(JSON.stringify(snapshot)) as Snapshot;
    const source = copy.sources.find((entry) => entry.id === 'lists')!;
    source.status = status;
    source.data = null;
    return copy;
  };
  const mount = (snap: Snapshot, fetchImpl: typeof fetch) =>
    render(
      <I18nextProvider i18n={i18n}>
        <SnapshotContext.Provider value={contextFixture(snap)}>
          <ShellContext.Provider value={{ layout: 'tablet', theme: 'day' }}>
            <DetailContext.Provider value={{ open: vi.fn() }}>
              <ListsProvider fetchImpl={fetchImpl}>
                <Tile definition={definition} index={0} />
              </ListsProvider>
            </DetailContext.Provider>
          </ShellContext.Provider>
        </SnapshotContext.Provider>
      </I18nextProvider>,
    );
  const ok = () => vi.fn(async () => json(state)) as unknown as typeof fetch;

  it('says the lists are not loaded yet before the first data arrives', () => {
    mount(withStatus('never-loaded'), ok());
    expect(screen.getByText(de.lists.states.neverLoaded.title)).toBeInTheDocument();
  });

  it('says the lists are unavailable when the first load failed', () => {
    mount(withStatus('error'), ok());
    expect(screen.getByText(de.lists.states.error.title)).toBeInTheDocument();
  });

  it('keeps the last lists on screen when a refresh fails', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    mount(snapshot, failing);
    await flush();
    expect(screen.getByRole('region', { name: de.lists.shopping })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: de.lists.todos })).toBeInTheDocument();
    expect(screen.queryByText(de.lists.states.error.title)).toBeNull();
  });
});
