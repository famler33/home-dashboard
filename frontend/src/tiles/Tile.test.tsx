import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { deriveTileStatus, type TileStatus } from '../snapshot/freshness';
import { contextFixture, renderWithProviders } from '../test-utils';
import { snapshotFixture, sourceFixture } from '../test-fixtures';
import { DemoTile } from './demo/DemoTile';
import { stateViews } from './TileState';
import { Tile } from './Tile';
import { TileFrame } from './TileFrame';
import type { TileDefinition } from './types';

const demoDefinition: TileDefinition = {
  id: 'demo',
  titleKey: 'tiles.demo',
  sourceId: 'demo',
  tablet: { col: 1, row: 1, colSpan: 4, rowSpan: 2 },
  phoneOrder: 0,
  isEmpty: (data) => !data || (typeof data === 'object' && Object.keys(data).length === 0),
  Component: DemoTile,
};

const allStatuses: TileStatus[] = ['loading', 'never-loaded', 'empty', 'error', 'fresh', 'stale'];

// Covers: FR-5, F-3, AC-9, AC-12
describe('TileFrame states', () => {
  it.each(allStatuses)('renders a labelled view for %s', (status) => {
    renderWithProviders(
      <TileFrame title="Demo" status={status} ageSeconds={status === 'stale' ? 300 : 12} index={0}>
        <p>Inhalt</p>
      </TileFrame>,
    );
    const tile = screen.getByRole('region', { name: 'Demo' });
    expect(tile).toHaveAttribute('data-status', status);
    expect((tile.textContent ?? '').trim().length).toBeGreaterThan('Demo'.length);
  });

  it('shows content for fresh and stale, and a state view otherwise', () => {
    for (const status of allStatuses) {
      const { unmount } = renderWithProviders(
        <TileFrame title="Demo" status={status} ageSeconds={20} index={0}>
          <p>Inhalt</p>
        </TileFrame>,
      );
      const hasContent = screen.queryByText('Inhalt') !== null;
      expect(hasContent, status).toBe(status === 'fresh' || status === 'stale');
      unmount();
    }
  });

  it('gives every state a unique label and icon', () => {
    const labels = new Set<string>();
    const icons = new Set<string>();
    for (const status of ['loading', 'never-loaded', 'empty', 'error'] as const) {
      const { container, unmount } = renderWithProviders(
        <TileFrame title="Demo" status={status} ageSeconds={null} index={0} />,
      );
      labels.add(screen.getByTestId('state-title').textContent ?? '');
      icons.add(
        container.querySelector('[data-state-icon]')?.getAttribute('data-state-icon') ?? '',
      );
      unmount();
    }
    expect(labels.size).toBe(4);
    expect(icons.size).toBe(4);
    expect(Object.keys(stateViews).sort()).toEqual([
      'crashed',
      'empty',
      'error',
      'loading',
      'never-loaded',
    ]);
  });

  it('sets an increasing --i on each tile for the staggered entrance', () => {
    renderWithProviders(
      <>
        <TileFrame title="A" status="fresh" ageSeconds={1} index={0} />
        <TileFrame title="B" status="fresh" ageSeconds={1} index={3} />
      </>,
    );
    expect(screen.getByRole('region', { name: 'A' }).style.getPropertyValue('--i')).toBe('0');
    expect(screen.getByRole('region', { name: 'B' }).style.getPropertyValue('--i')).toBe('3');
  });

  it('yields non-empty accessible text for all status and data combinations', () => {
    for (const source of [
      undefined,
      sourceFixture({ data: null }),
      sourceFixture(),
      sourceFixture({ status: 'stale', ageSeconds: 999 }),
      sourceFixture({ status: 'error', data: null, ageSeconds: null }),
      sourceFixture({ status: 'never-loaded', data: null, ageSeconds: null }),
    ]) {
      for (const snapshotPresent of [true, false]) {
        const status = deriveTileStatus({
          source,
          snapshotPresent,
          receivedAt: 0,
          nowMono: 0,
          isEmpty: () => false,
        });
        const { unmount } = renderWithProviders(
          <TileFrame title="Demo" status={status} ageSeconds={source?.ageSeconds ?? null} index={0}>
            <p>Inhalt</p>
          </TileFrame>,
        );
        const tile = screen.getByRole('region', { name: 'Demo' });
        expect(within(tile).getAllByText(/\S/).length).toBeGreaterThan(1);
        unmount();
      }
    }
  });
});

// Covers: FR-6, FR-7, AC-10, AC-11, AC-36
describe('Tile (connected)', () => {
  it('formats the age as German relative time and keeps the last data when stale', () => {
    const snapshot = snapshotFixture({
      sources: [sourceFixture({ status: 'stale', ageSeconds: 300, data: { value: 7 } })],
    });
    renderWithProviders(<Tile definition={demoDefinition} index={0} />, contextFixture(snapshot));
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/zuletzt aktualisiert vor 5 Min\./)).toBeInTheDocument();
  });

  it('marks a stale tile with the warn accent, an icon and the stale label', () => {
    const snapshot = snapshotFixture({
      sources: [sourceFixture({ status: 'stale', ageSeconds: 300 })],
    });
    const { container } = renderWithProviders(
      <Tile definition={demoDefinition} index={0} />,
      contextFixture(snapshot),
    );
    const footer = screen.getByTestId('tile-footer');
    expect(footer.className).toContain('text-warn');
    expect(footer.querySelector('svg')).not.toBeNull();
    expect(screen.getByText(de.tile.stale)).toBeInTheDocument();
    expect(container.querySelector('[data-status="stale"]')).not.toBeNull();
  });

  it('uses "gerade eben" for ages under 15 seconds, never "vor 0"', () => {
    const snapshot = snapshotFixture({ sources: [sourceFixture({ ageSeconds: 4 })] });
    renderWithProviders(<Tile definition={demoDefinition} index={0} />, contextFixture(snapshot));
    expect(screen.getByText(/gerade eben/)).toBeInTheDocument();
    expect(screen.queryByText(/vor 0/)).toBeNull();
  });

  it('keeps ageing between polls using the monotonic clock', () => {
    const snapshot = snapshotFixture({
      sources: [sourceFixture({ ageSeconds: 100, staleAfterSeconds: 120 })],
    });
    renderWithProviders(
      <Tile definition={demoDefinition} index={0} />,
      contextFixture(snapshot, { receivedAtMonotonic: 0, nowMono: 200_000 }),
    );
    expect(screen.getByRole('region')).toHaveAttribute('data-status', 'stale');
    expect(screen.getByText(/vor 5 Min\./)).toBeInTheDocument();
  });

  it('keeps stale content visible while the backend is offline', () => {
    const snapshot = snapshotFixture({ sources: [sourceFixture({ ageSeconds: 10 })] });
    renderWithProviders(
      <Tile definition={demoDefinition} index={0} />,
      contextFixture(snapshot, { offline: true }),
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('never renders an empty body for null data', () => {
    const snapshot = snapshotFixture({ sources: [sourceFixture({ data: null })] });
    renderWithProviders(<Tile definition={demoDefinition} index={0} />, contextFixture(snapshot));
    expect(screen.getByRole('region')).toHaveAttribute('data-status', 'empty');
    expect(screen.getByText(de.states.empty.title)).toBeInTheDocument();
  });

  it('shows loading before the first snapshot', () => {
    renderWithProviders(<Tile definition={demoDefinition} index={0} />, contextFixture(null));
    expect(screen.getByRole('region')).toHaveAttribute('data-status', 'loading');
  });

  it('shows the error state when the first fetch failed', () => {
    const snapshot = snapshotFixture({
      sources: [
        sourceFixture({
          status: 'error',
          data: null,
          ageSeconds: null,
          lastUpdated: null,
          lastErrorCode: 'SOURCE_FETCH_FAILED',
        }),
      ],
    });
    renderWithProviders(<Tile definition={demoDefinition} index={0} />, contextFixture(snapshot));
    expect(screen.getByText(de.states.error.title)).toBeInTheDocument();
  });

  it('shows the crashed state when a tile component throws and keeps other tiles', () => {
    const Crashing = () => {
      throw new Error('boom');
    };
    const crashing: TileDefinition = {
      ...demoDefinition,
      id: 'crash',
      titleKey: 'tiles.weather',
      sourceId: undefined,
      Component: Crashing,
    };
    const healthy: TileDefinition = {
      ...demoDefinition,
      id: 'ok',
      titleKey: 'tiles.news',
      sourceId: undefined,
      Component: () => <p>Alles gut</p>,
    };
    const original = console.error;
    console.error = () => {};
    try {
      renderWithProviders(
        <>
          <Tile definition={crashing} index={0} />
          <Tile definition={healthy} index={1} />
        </>,
      );
    } finally {
      console.error = original;
    }
    expect(screen.getByText(de.states.crashed.title)).toBeInTheDocument();
    expect(screen.getByText('Alles gut')).toBeInTheDocument();
  });

  it('renders tiles without a source directly, without a freshness footer', () => {
    const plain: TileDefinition = {
      ...demoDefinition,
      sourceId: undefined,
      Component: () => <p>Statisch</p>,
    };
    renderWithProviders(<Tile definition={plain} index={0} />, contextFixture(null));
    expect(screen.getByText('Statisch')).toBeInTheDocument();
    expect(screen.queryByTestId('tile-footer')).toBeNull();
  });
});
