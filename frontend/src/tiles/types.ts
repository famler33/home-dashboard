import type { ParseKeys, TFunction } from 'i18next';
import type { Snapshot, SourceSnapshot } from '../api/types';
import type { ComponentType, ReactNode } from 'react';

export interface TileContentProps {
  /** Last known payload of the bound source, `null` for tiles without a source. */
  data: unknown;
}

export interface StateTextKeys {
  titleKey: ParseKeys;
  hintKey: ParseKeys;
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
  /** Full heading derived from the payload (which is `null` until data exists); `null` keeps the base title. */
  heading?: (data: unknown, t: TFunction) => ReactNode | null;
  /** Replaces the generic texts of the never-loaded and error states. */
  stateTexts?: Partial<Record<'never-loaded' | 'error', StateTextKeys>>;
  /** Set to false to show the update footer only while the data is stale. */
  freshFooter?: boolean;
  /** Backend source whose freshness this tile shows. */
  sourceId?: string | undefined;
  /** Full-screen detail view opened from the heading on the wall tablet. */
  detail?: ComponentType<{ onClose(): void }>;
  /** Accessible name of the heading button and of the dialog. */
  detailLabelKey?: ParseKeys;
  /** The tile shows when any of these sources is in the snapshot (with `requiresSource`). */
  sourceIds?: readonly string[];
  /** Entry that drives the tile frame when several sources feed the tile. */
  deriveEntry?: (snapshot: Snapshot | null) => SourceSnapshot | undefined;
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
