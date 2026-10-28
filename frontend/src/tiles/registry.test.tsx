import { describe, expect, it } from 'vitest';
import { snapshotFixture, sourceFixture } from '../test-fixtures';
import { assertNoOverlaps, findOverlaps, tileRegistry, visibleTiles } from './registry';
import type { TileDefinition } from './types';

const sample = (
  id: string,
  area: TileDefinition['tablet'],
  extra: Partial<TileDefinition> = {},
): TileDefinition => ({
  id,
  titleKey: 'tiles.weather',
  tablet: area,
  phoneOrder: 5,
  Component: () => null,
  ...extra,
});

// Covers: FR-1, FR-4, FR-14, AC-1, AC-4, AC-21
describe('tile registry', () => {
  it('ships placeholder tiles for weather, calendar, lists and news', () => {
    const ids = tileRegistry.map((tile) => tile.id);
    expect(ids).toEqual(expect.arrayContaining(['weather', 'calendar', 'lists', 'news']));
  });

  it('keeps all tablet areas inside the 12 x 6 grid', () => {
    for (const tile of tileRegistry) {
      const { col, row, colSpan, rowSpan } = tile.tablet;
      expect(col).toBeGreaterThanOrEqual(1);
      expect(row).toBeGreaterThanOrEqual(1);
      expect(col + colSpan - 1).toBeLessThanOrEqual(12);
      expect(row + rowSpan - 1).toBeLessThanOrEqual(6);
    }
  });

  it('has no overlapping areas among tiles that are shown together', () => {
    expect(findOverlaps(tileRegistry)).toEqual([]);
  });

  it('rejects registry entries whose grid areas overlap', () => {
    const overlapping = [
      sample('a', { col: 1, row: 1, colSpan: 4, rowSpan: 2 }),
      sample('b', { col: 4, row: 2, colSpan: 3, rowSpan: 2 }),
    ];
    expect(findOverlaps(overlapping)).toEqual([['a', 'b']]);
    expect(() => assertNoOverlaps(overlapping)).toThrowError(/overlap/);
  });

  it('allows a tile to replace another one in the same area', () => {
    const replacing = [
      sample('a', { col: 1, row: 1, colSpan: 4, rowSpan: 2 }),
      sample('b', { col: 1, row: 1, colSpan: 4, rowSpan: 2 }, { replaces: 'a' }),
    ];
    expect(findOverlaps(replacing)).toEqual([]);
  });

  it('orders phone tiles by phoneOrder with lists first', () => {
    const ordered = [...visibleTiles(tileRegistry, snapshotFixture({ sources: [] }))].sort(
      (a, b) => a.phoneOrder - b.phoneOrder,
    );
    expect(ordered[0]?.id).toBe('lists');
  });

  it('hides source-bound tiles whose source is absent and shows them when present', () => {
    const bound = sample(
      'bound',
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
      { sourceId: 'x', requiresSource: true },
    );
    expect(visibleTiles([bound], snapshotFixture({ sources: [] }))).toEqual([]);
    expect(visibleTiles([bound], null)).toEqual([]);
    expect(
      visibleTiles([bound], snapshotFixture({ sources: [sourceFixture({ id: 'x' })] })),
    ).toHaveLength(1);
  });

  it('removes the replaced tile when its replacement is visible', () => {
    const base = sample('base', { col: 1, row: 1, colSpan: 2, rowSpan: 2 });
    const replacement = sample(
      'rep',
      { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
      { sourceId: 'x', requiresSource: true, replaces: 'base' },
    );
    const without = visibleTiles([base, replacement], snapshotFixture({ sources: [] })).map(
      (t) => t.id,
    );
    const withSource = visibleTiles(
      [base, replacement],
      snapshotFixture({ sources: [sourceFixture({ id: 'x' })] }),
    ).map((t) => t.id);
    expect(without).toEqual(['base']);
    expect(withSource).toEqual(['rep']);
  });
});

// Covers: FR-1, FR-17, AC-41 (weather gets the taller left cell)
describe('weather tile area', () => {
  it('gives the live weather tile and its placeholder four rows and the lists tile the remaining two', () => {
    const area = (id: string) => tileRegistry.find((tile) => tile.id === id)!.tablet;
    expect(area('weather')).toMatchObject({ col: 1, row: 1, colSpan: 5, rowSpan: 4 });
    expect(area('weather-live')).toEqual(area('weather'));
    expect(area('lists')).toMatchObject({ col: 1, row: 5, colSpan: 5, rowSpan: 2 });
  });

  it('replaces the weather placeholder when the weather source exists', () => {
    const shown = visibleTiles(
      tileRegistry,
      snapshotFixture({ sources: [sourceFixture({ id: 'weather' })] }),
    ).map((tile) => tile.id);
    expect(shown).toContain('weather-live');
    expect(shown).not.toContain('weather');
  });

  it('keeps the placeholder without a weather source', () => {
    const shown = visibleTiles(tileRegistry, snapshotFixture({ sources: [] })).map(
      (tile) => tile.id,
    );
    expect(shown).toContain('weather');
    expect(shown).not.toContain('weather-live');
  });
});
