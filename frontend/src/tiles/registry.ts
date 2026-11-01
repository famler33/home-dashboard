import type { Snapshot } from '../api/types';
import { CalendarTile } from './calendar/CalendarTile';
import { deriveCalendarEntry } from './calendar/derive';
import { DemoTile } from './demo/DemoTile';
import { weatherHeading } from './weather/heading';
import { isWeatherPayload } from './weather/types';
import { WeatherTile } from './weather/WeatherTile';
import { ListsDetail } from './lists/ListsDetail';
import { ListsTileContent } from './lists/ListsTile';
import { deriveNewsEntry } from './news/derive';
import { NewsTile } from './news/NewsTile';
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
    id: 'lists-live',
    titleKey: 'tiles.lists',
    sourceId: 'lists',
    requiresSource: true,
    replaces: 'lists',
    detail: ListsDetail,
    detailLabelKey: 'lists.open',
    tablet: { col: 1, row: 5, colSpan: 5, rowSpan: 2 },
    phoneOrder: 0,
    stateTexts: {
      'never-loaded': {
        titleKey: 'lists.states.neverLoaded.title',
        hintKey: 'lists.states.neverLoaded.hint',
      },
      error: { titleKey: 'lists.states.error.title', hintKey: 'lists.states.error.hint' },
    },
    freshFooter: false,
    isEmpty: () => false,
    Component: ListsTileContent,
  },
  {
    id: 'calendar',
    titleKey: 'tiles.calendar',
    tablet: { col: 6, row: 1, colSpan: 7, rowSpan: 4 },
    phoneOrder: 1,
    Component: PlaceholderTile,
  },
  {
    id: 'calendar-live',
    titleKey: 'tiles.calendar',
    sourceIds: ['calendar-family', 'calendar-person-1', 'calendar-person-2'],
    requiresSource: true,
    replaces: 'calendar',
    deriveEntry: deriveCalendarEntry,
    tablet: { col: 6, row: 1, colSpan: 7, rowSpan: 4 },
    phoneOrder: 1,
    stateTexts: {
      'never-loaded': {
        titleKey: 'calendar.states.neverLoaded.title',
        hintKey: 'calendar.states.neverLoaded.hint',
      },
      error: { titleKey: 'calendar.states.error.title', hintKey: 'calendar.states.error.hint' },
    },
    freshFooter: false,
    Component: CalendarTile,
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
    heading: weatherHeading,
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
    tablet: { col: 6, row: 5, colSpan: 7, rowSpan: 2 },
    phoneOrder: 3,
    Component: PlaceholderTile,
  },
  {
    id: 'news-live',
    titleKey: 'tiles.news',
    sourceIds: ['news-local', 'news-global'],
    requiresSource: true,
    replaces: ['news', 'demo'],
    deriveEntry: deriveNewsEntry,
    tablet: { col: 6, row: 5, colSpan: 7, rowSpan: 2 },
    phoneOrder: 3,
    dense: true,
    stateTexts: {
      'never-loaded': {
        titleKey: 'news.states.neverLoaded.title',
        hintKey: 'news.states.neverLoaded.hint',
      },
      error: { titleKey: 'news.states.error.title', hintKey: 'news.states.error.hint' },
    },
    freshFooter: false,
    Component: NewsTile,
  },
  {
    id: 'demo',
    titleKey: 'tiles.demo',
    sourceId: 'demo',
    requiresSource: true,
    replaces: 'news',
    tablet: { col: 6, row: 5, colSpan: 7, rowSpan: 2 },
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
    (tile) =>
      !tile.requiresSource ||
      (tile.sourceId !== undefined && sourceIds.has(tile.sourceId)) ||
      (tile.sourceIds?.some((id) => sourceIds.has(id)) ?? false),
  );
  const replaced = new Set(shown.flatMap((tile) => replacedIds(tile)));
  return shown.filter((tile) => !replaced.has(tile.id));
}

function replacedIds(tile: TileDefinition): readonly string[] {
  if (tile.replaces === undefined) return [];
  return typeof tile.replaces === 'string' ? [tile.replaces] : tile.replaces;
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
      const replacement = replacedIds(a).includes(b.id) || replacedIds(b).includes(a.id);
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
