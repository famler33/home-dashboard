import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createI18n } from '../i18n';
import { de } from '../i18n/de';
import { snapshotFixture, sourceFixture } from '../test-fixtures';
import { PlaceholderTile } from '../tiles/PlaceholderTile';
import { tileRegistry } from '../tiles/registry';
import type { TileDefinition } from '../tiles/types';
import { contextFixture, renderWithProviders } from '../test-utils';
import { Shell } from './Shell';
import { StatusDot } from './StatusDot';

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-10-28T11:04:00Z') }); // 12:04 Berlin, day
});

const titles = () =>
  screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

// Covers: FR-1, FR-4, FR-14, AC-1, AC-4, AC-21, AC-36
describe('Shell tablet layout', () => {
  it('renders the clock, the German date and one tile per registry entry', () => {
    renderWithProviders(
      <Shell layout="tablet" />,
      contextFixture(snapshotFixture({ sources: [] })),
    );
    expect(screen.getByLabelText('Es ist 12:04 Uhr')).toBeInTheDocument();
    expect(screen.getByText('Mittwoch, 28. Oktober 2026')).toBeInTheDocument();
    expect(titles()).toEqual(
      expect.arrayContaining([de.tiles.weather, de.tiles.calendar, de.tiles.lists, de.tiles.news]),
    );
    expect(titles()).toHaveLength(4);
  });

  it('places each tile on the declared grid area', () => {
    renderWithProviders(
      <Shell layout="tablet" />,
      contextFixture(snapshotFixture({ sources: [] })),
    );
    const lists = screen.getByRole('region', { name: de.tiles.lists }).parentElement as HTMLElement;
    const area = tileRegistry.find((tile) => tile.id === 'lists')!.tablet;
    expect(lists.style.gridColumn).toBe(`${area.col} / span ${area.colSpan}`);
    expect(lists.style.gridRow).toBe(`${area.row} / span ${area.rowSpan}`);
  });

  it('renders a tile added to a test registry without shell changes', () => {
    const extra: TileDefinition = {
      id: 'extra',
      titleKey: 'tiles.demo',
      tablet: { col: 9, row: 1, colSpan: 4, rowSpan: 2 },
      phoneOrder: 9,
      Component: PlaceholderTile,
    };
    renderWithProviders(
      <Shell layout="tablet" registry={[...tileRegistry.slice(0, 4), extra]} />,
      contextFixture(snapshotFixture({ sources: [] })),
    );
    expect(titles()).toContain(de.tiles.demo);
  });

  it('replaces the news placeholder with the demo tile while the demo source exists', () => {
    renderWithProviders(
      <Shell layout="tablet" />,
      contextFixture(snapshotFixture({ sources: [sourceFixture()] })),
    );
    expect(titles()).toContain(de.tiles.demo);
    expect(titles()).not.toContain(de.tiles.news);
  });

  it('shows the offline indicator only while offline', () => {
    const { unmount } = renderWithProviders(
      <Shell layout="tablet" />,
      contextFixture(snapshotFixture(), { offline: false }),
    );
    expect(screen.queryByText(de.status.offline)).toBeNull();
    unmount();
    renderWithProviders(
      <Shell layout="tablet" />,
      contextFixture(snapshotFixture(), { offline: true }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(de.status.offline);
  });

  it('applies the drift as a transform on the wrapper in the tablet layout', async () => {
    renderWithProviders(
      <Shell layout="tablet" />,
      contextFixture(snapshotFixture({ sources: [] })),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(screen.getByTestId('drift-wrapper').style.transform).toMatch(/translate3d\(/);
  });
});

describe('Shell theme', () => {
  it('uses the day theme at noon and the night theme at 23:00 with the same tiles', async () => {
    const context = contextFixture(snapshotFixture({ sources: [] }));
    renderWithProviders(<Shell layout="tablet" />, context);
    expect(document.documentElement.dataset['theme']).toBe('day');
    const dayTitles = titles();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11 * 60 * 60_000);
    }); // 23:04 Berlin
    expect(document.documentElement.dataset['theme']).toBe('night');
    expect(titles()).toEqual(dayTitles);
  });
});

describe('Shell phone layout', () => {
  it('orders phone tiles by phoneOrder with lists first and applies no drift', async () => {
    renderWithProviders(<Shell layout="phone" />, contextFixture(snapshotFixture({ sources: [] })));
    expect(titles()[0]).toBe(de.tiles.lists);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(screen.queryByTestId('drift-wrapper')).toBeNull();
  });

  it('keeps the clock and the offline indicator on the phone', () => {
    renderWithProviders(
      <Shell layout="phone" />,
      contextFixture(snapshotFixture(), { offline: true }),
    );
    expect(screen.getByLabelText('Es ist 12:04 Uhr')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows no fullscreen hint on the phone', () => {
    renderWithProviders(<Shell layout="phone" />, contextFixture(snapshotFixture()));
    expect(screen.queryByText(de.kiosk.tapForFullscreen)).toBeNull();
  });
});

// Covers: FR-2, NFR-9, AC-3
describe('Shell texts', () => {
  it('renders the shell with only dictionary text', () => {
    const pseudo = JSON.parse(JSON.stringify(de), (_key, value) =>
      typeof value === 'string' ? `§${value}` : value,
    );
    const instance = createI18n(pseudo, 'xx');
    renderWithProviders(
      <Shell layout="tablet" />,
      contextFixture(snapshotFixture({ sources: [] }), { offline: true }),
      instance,
    );
    const body = document.body.textContent ?? '';
    for (const text of [
      de.tiles.weather,
      de.tiles.news,
      de.placeholder.title,
      de.status.offline,
      de.tile.justNow,
    ]) {
      expect(body, text).not.toMatch(
        new RegExp(`(^|[^§])${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      );
    }
    expect(body).toContain(`§${de.tiles.weather}`);
  });
});

describe('StatusDot', () => {
  it('renders nothing while online', () => {
    const { container } = renderWithProviders(<StatusDot offline={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a labelled status while offline', () => {
    renderWithProviders(<StatusDot offline />);
    const status = screen.getByRole('status');
    expect(within(status).getByText(de.status.offline)).toBeInTheDocument();
    expect(status.querySelector('svg')).not.toBeNull();
  });
});
