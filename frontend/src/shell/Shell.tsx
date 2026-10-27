import { useTranslation } from 'react-i18next';
import { useSnapshot } from '../snapshot/useSnapshot';
import { Tile } from '../tiles/Tile';
import { tileRegistry, visibleTiles } from '../tiles/registry';
import type { TileDefinition } from '../tiles/types';
import { Clock } from './Clock';
import { StatusDot } from './StatusDot';
import { useBurnInDrift } from './useBurnInDrift';
import { useDayNight } from './useDayNight';
import { useKioskMode } from './useKioskMode';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useLayoutMode, type LayoutMode } from './useLayoutMode';

interface Props {
  registry?: readonly TileDefinition[];
  /** Overrides the media-query based choice (tests). */
  layout?: LayoutMode;
}

export function Shell({ registry = tileRegistry, layout }: Props) {
  const { t } = useTranslation();
  const detected = useLayoutMode();
  const mode = layout ?? detected;
  const { snapshot, offline } = useSnapshot();
  const theme = useDayNight(snapshot?.settings);
  const reducedMotion = usePrefersReducedMotion();
  const drift = useBurnInDrift({ enabled: mode === 'tablet', theme, reducedMotion });
  const { showHint } = useKioskMode({ enabled: mode === 'tablet' });
  const tiles = visibleTiles(registry, snapshot);
  const timeZone = snapshot?.settings.timezone;

  if (mode === 'phone') {
    const ordered = [...tiles].sort((a, b) => a.phoneOrder - b.phoneOrder);
    return (
      <div className="flex min-h-dvh flex-col gap-4 p-4">
        <header className="flex items-start justify-between gap-3">
          <Clock timeZone={timeZone} compact />
          <StatusDot offline={offline} />
        </header>
        <main className="flex flex-col gap-4">
          {ordered.map((tile, index) => (
            <div key={tile.id} className="min-h-40">
              <Tile definition={tile} index={index} />
            </div>
          ))}
        </main>
      </div>
    );
  }

  return (
    <div
      data-testid="drift-wrapper"
      className="relative h-dvh w-screen overflow-hidden"
      style={{
        transform: `translate3d(${drift.x}px, ${drift.y}px, 0)`,
        transition: drift.animate ? 'transform 60s ease-in-out' : 'none',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-ambient absolute -left-1/4 -top-1/4 h-[70%] w-[60%] rounded-full bg-accent/10 blur-3xl" />
        <div className="animate-ambient absolute -bottom-1/4 -right-1/4 h-[60%] w-[55%] rounded-full bg-warn/10 blur-3xl [animation-direction:alternate-reverse]" />
      </div>
      <div className="relative grid h-full grid-rows-[auto_minmax(0,1fr)] gap-8 p-10">
        <header className="flex items-start justify-between">
          <Clock timeZone={timeZone} />
          <StatusDot offline={offline} />
        </header>
        <main className="grid min-h-0 grid-cols-12 grid-rows-6 gap-6">
          {tiles.map((tile, index) => (
            <div
              key={tile.id}
              className="min-h-0"
              style={{
                gridColumn: `${tile.tablet.col} / span ${tile.tablet.colSpan}`,
                gridRow: `${tile.tablet.row} / span ${tile.tablet.rowSpan}`,
              }}
            >
              <Tile definition={tile} index={index} />
            </div>
          ))}
        </main>
      </div>
      {showHint && (
        <p
          role="note"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-surface-raised px-6 py-2 text-caption text-ink-muted shadow-sm"
        >
          {t('kiosk.tapForFullscreen')}
        </p>
      )}
    </div>
  );
}
