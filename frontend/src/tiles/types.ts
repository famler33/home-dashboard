import type { ParseKeys } from 'i18next';
import type { ComponentType } from 'react';

export interface TileContentProps {
  /** Last known payload of the bound source, `null` for tiles without a source. */
  data: unknown;
}

export interface GridArea {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface TileDefinition {
  id: string;
  titleKey: ParseKeys;
  /** Backend source whose freshness this tile shows. */
  sourceId?: string | undefined;
  /** Hide the tile while its source is absent from the snapshot. */
  requiresSource?: boolean;
  /** Id of a tile this one takes the place of while it is visible. */
  replaces?: string;
  /** Position on the 12 x 6 tablet grid. */
  tablet: GridArea;
  /** Order in the single-column phone layout; lists come first. */
  phoneOrder: number;
  isEmpty?: (data: unknown) => boolean;
  Component: ComponentType<TileContentProps>;
}
