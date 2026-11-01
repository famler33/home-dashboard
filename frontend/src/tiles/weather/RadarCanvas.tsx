import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildLookup, mapView } from './radar-geo';
import { intensityRamp, renderFrame, type DecodedFrame } from './radar-render';
import type { RadarDocument } from './types';

interface Props {
  doc: RadarDocument;
  frames: DecodedFrame[];
  frameIndex: number;
  night: boolean;
}

type BasemapState = 'loading' | 'ready' | 'failed';

const NIGHT_FILTER = '[filter:invert(0.92)_hue-rotate(180deg)_saturate(0.6)_brightness(0.8)]';

export function RadarCanvas({ doc, frames, frameIndex, night }: Props) {
  const { t } = useTranslation();
  const view = useMemo(() => mapView(doc), [doc]);
  const lookup = useMemo(() => buildLookup(doc, view), [doc, view]);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [basemap, setBasemap] = useState<BasemapState>('loading');

  // Basemap: same-origin tiles drawn once per document; range rings when they cannot be loaded.
  useEffect(() => {
    const context = baseRef.current?.getContext('2d');
    if (!context) return undefined;
    let cancelled = false;
    let pending = doc.map.tiles.length;
    let failed = false;
    const images: HTMLImageElement[] = [];

    const finish = (): void => {
      if (cancelled || pending > 0) return;
      if (failed) {
        const metersPerPixel =
          (156543.03392 * Math.cos((doc.home.lat * Math.PI) / 180)) / 2 ** doc.map.zoom;
        for (const km of [25, 50]) {
          context.beginPath();
          context.arc(view.homeX, view.homeY, (km * 1000) / metersPerPixel, 0, Math.PI * 2);
          context.stroke();
        }
        setBasemap('failed');
      } else {
        for (const { image, tile } of drawn) {
          context.drawImage(
            image,
            tile.x * doc.map.tileSize - view.originX,
            tile.y * doc.map.tileSize - view.originY,
          );
        }
        setBasemap('ready');
      }
    };

    const drawn: { image: HTMLImageElement; tile: { x: number; y: number } }[] = [];
    for (const tile of doc.map.tiles) {
      const image = new Image();
      images.push(image);
      image.onload = () => {
        drawn.push({ image, tile });
        pending -= 1;
        finish();
      };
      image.onerror = () => {
        failed = true;
        pending -= 1;
        finish();
      };
      image.src = `/api/v1/weather/basemap/${doc.map.zoom}/${tile.x}/${tile.y}`;
    }
    if (pending === 0) finish();

    return () => {
      cancelled = true;
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, [doc, view]);

  // Radar frame and home marker on the overlay.
  useEffect(() => {
    const frame = frames[frameIndex];
    const context = overlayRef.current?.getContext('2d');
    if (!frame || !context) return;
    const image = context.createImageData(view.width, view.height);
    renderFrame(frame.bytes, lookup, intensityRamp(), new Uint32Array(image.data.buffer));
    context.putImageData(image, 0, 0);
    context.beginPath();
    context.arc(view.homeX, view.homeY, 7, 0, Math.PI * 2);
    context.stroke();
  }, [frames, frameIndex, lookup, view]);

  return (
    <div
      role="img"
      aria-label={t('weather.radar.canvas')}
      data-basemap={basemap}
      className="relative h-full w-full overflow-hidden rounded-2xl bg-surface"
    >
      <canvas
        ref={baseRef}
        width={view.width}
        height={view.height}
        className={`absolute inset-0 h-full w-full object-cover ${night ? NIGHT_FILTER : ''}`}
      />
      <canvas
        ref={overlayRef}
        width={view.width}
        height={view.height}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
