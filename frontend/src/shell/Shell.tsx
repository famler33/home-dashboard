import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnapshot } from '../snapshot/useSnapshot';
import { Tile } from '../tiles/Tile';
import { tileRegistry, visibleTiles } from '../tiles/registry';
import type { TileDefinition } from '../tiles/types';
import { Clock } from './Clock';
import { DetailContext } from './detail-context';
import { DetailOverlay } from './DetailOverlay';
import { StatusDot } from './StatusDot';
import { useBurnInDrift } from './useBurnInDrift';
import { useDayNight } from './useDayNight';
import { useKioskMode } from './useKioskMode';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { useLayoutMode, type LayoutMode } from './useLayoutMode';
import { ShellContext } from './shell-context';

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

  const shellValue = { layout: mode, theme } as const;

  const [openId, setOpenId] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const openDetail = useCallback((tileId: string, source?: HTMLElement | null) => {
    trigger.current = source ?? null;
    setOpenId(tileId);
  }, []);
  const closeDetail = useCallback(() => setOpenId(null), []);
  const detailValue = { open: openDetail };
  const openTile = openId === null ? undefined : tiles.find((tile) => tile.id === openId);

  useEffect(() => {
    if (openId === null) trigger.current?.focus();
  }, [openId]);

  if (mode === 'phone') {
    const ordered = [...tiles].sort((a, b) => a.phoneOrder - b.phoneOrder);
    return (
      <ShellContext.Provider value={shellValue}>
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
      </ShellContext.Provider>
    );
  }

  return (
    <ShellContext.Provider value={shellValue}>
      <DetailContext.Provider value={detailValue}>
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
          <div inert={openTile !== undefined} className="relative h-full">
            <div className="relative grid h-full grid-rows-[auto_minmax(0,1fr)] gap-6 p-8 tablet-short:gap-4 tablet-short:p-6">
              <header className="flex items-start justify-between gap-6">
                <Clock timeZone={timeZone} />
                <div className="flex flex-1 justify-center pt-2">
                  {showHint && (
                    <p
                      role="note"
                      className="rounded-full bg-surface-raised px-6 py-2 text-caption text-ink-muted shadow-sm"
                    >
                      {t('kiosk.tapForFullscreen')}
                    </p>
                  )}
                </div>
                <StatusDot offline={offline} />
              </header>
              <main className="grid min-h-0 grid-cols-12 grid-rows-6 gap-6 tablet-short:gap-4">
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
          </div>
          {openTile && <DetailOverlay definition={openTile} onClose={closeDetail} />}
        </div>
      </DetailContext.Provider>
    </ShellContext.Provider>
  );
}
