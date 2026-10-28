import type { Snapshot } from '../api/types';
import { DemoTile } from './demo/DemoTile';
import { isWeatherPayload } from './weather/types';
import { WeatherTile } from './weather/WeatherTile';
import { PlaceholderTile } from './PlaceholderTile';
import type { TileDefinition } from './types';

export const tileRegistry: readonly TileDefinition[] = [
  {
    id: 'lists',
    titleKey: 'tiles.lists',
    tablet: { col: 1, row: 5, colSpan: 5, rowSpan: 2 },
    phoneOrder: 0,
    Component: PlaceholderTile,
  },
  {
    id: 'calendar',
    titleKey: 'tiles.calendar',
    tablet: { col: 6, row: 1, colSpan: 7, rowSpan: 3 },
    phoneOrder: 1,
    Component: PlaceholderTile,
  },
  {
    id: 'weather',
    titleKey: 'tiles.weather',
    tablet: { col: 1, row: 1, colSpan: 5, rowSpan: 4 },
    phoneOrder: 2,
    Component: PlaceholderTile,
  },
  {
    id: 'weather-live',
    titleKey: 'tiles.weather',
    sourceId: 'weather',
    requiresSource: true,
    replaces: 'weather',
    tablet: { col: 1, row: 1, colSpan: 5, rowSpan: 4 },
    phoneOrder: 2,
    heading: (data, t) =>
      isWeatherPayload(data) ? t('weather.heading', { location: data.location.name }) : null,
    stateTexts: {
      'never-loaded': {
        titleKey: 'weather.states.neverLoaded.title',
        hintKey: 'weather.states.neverLoaded.hint',
      },
      error: { titleKey: 'weather.states.error.title', hintKey: 'weather.states.error.hint' },
    },
    freshFooter: false,
    isEmpty: (data) => !isWeatherPayload(data),
    Component: WeatherTile,
  },
  {
    id: 'news',
    titleKey: 'tiles.news',
    tablet: { col: 6, row: 4, colSpan: 7, rowSpan: 3 },
    phoneOrder: 3,
    Component: PlaceholderTile,
  },
  {
    id: 'demo',
    titleKey: 'tiles.demo',
    sourceId: 'demo',
    requiresSource: true,
    replaces: 'news',
    tablet: { col: 6, row: 4, colSpan: 7, rowSpan: 3 },
    phoneOrder: 3,
    isEmpty: (data) => data === null || data === undefined,
    Component: DemoTile,
  },
];

export function visibleTiles(
  registry: readonly TileDefinition[],
  snapshot: Snapshot | null,
): TileDefinition[] {
  const sourceIds = new Set(snapshot?.sources.map((source) => source.id));
  const shown = registry.filter(
    (tile) => !tile.requiresSource || (tile.sourceId !== undefined && sourceIds.has(tile.sourceId)),
  );
  const replaced = new Set(shown.flatMap((tile) => (tile.replaces ? [tile.replaces] : [])));
  return shown.filter((tile) => !replaced.has(tile.id));
}

function intersects(a: TileDefinition['tablet'], b: TileDefinition['tablet']): boolean {
  return (
    a.col < b.col + b.colSpan &&
    b.col < a.col + a.colSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan
  );
}

export function findOverlaps(registry: readonly TileDefinition[]): [string, string][] {
  const overlaps: [string, string][] = [];
  registry.forEach((a, i) => {
    registry.slice(i + 1).forEach((b) => {
      const replacement = a.replaces === b.id || b.replaces === a.id;
      if (!replacement && intersects(a.tablet, b.tablet)) overlaps.push([a.id, b.id]);
    });
  });
  return overlaps;
}

export function assertNoOverlaps(registry: readonly TileDefinition[]): void {
  const overlaps = findOverlaps(registry);
  if (overlaps.length > 0) {
    throw new Error(`tile areas overlap: ${overlaps.map(([a, b]) => `${a}/${b}`).join(', ')}`);
  }
}
