import { useTranslation } from 'react-i18next';
import type { SourceSnapshot } from '../../api/types';
import { usePrefersReducedMotion } from '../../shell/usePrefersReducedMotion';
import { Credits } from './Credits';
import { formatAge, formatClock } from './format';
import { RadarCanvas } from './RadarCanvas';
import { intensityLegend, legendCss } from './radar-render';
import { isRadarPayload } from './types';
import { useRadarDocument } from './useRadarDocument';
import { useRadarLoop } from './useRadarLoop';

interface Props {
  radar: SourceSnapshot | undefined;
  radarAgeSeconds: number | null;
  layout: 'wall' | 'phone';
  /** True while the view is visible; the document is only loaded and the loop only runs then. */
  active: boolean;
  night: boolean;
  timeZone: string;
  fetchImpl?: typeof fetch;
}

function Message({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl bg-surface text-center text-caption text-ink-muted">
      <p>{text}</p>
    </div>
  );
}

export function RadarView({
  radar,
  radarAgeSeconds,
  layout,
  active,
  night,
  timeZone,
  fetchImpl,
}: Props) {
  const { t, i18n } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const payload = radar && isRadarPayload(radar.data) ? radar.data : null;
  const usable =
    !!radar && (radar.status === 'fresh' || radar.status === 'stale') && payload !== null;

  const { status, doc, frames } = useRadarDocument({
    version: usable ? payload.version : undefined,
    enabled: active && usable,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
  const currentIndex = Math.max(
    0,
    frames.findLastIndex((frame) => frame.kind === 'observed'),
  );
  const index = useRadarLoop({
    frameCount: frames.length,
    startIndex: currentIndex,
    active: active && status === 'ready',
    reducedMotion: reduced,
  });

  const frameClass = layout === 'wall' ? 'h-full' : 'h-64';

  if (!radar || radar.status === 'never-loaded') {
    return (
      <div className={frameClass}>
        <Message text={t('weather.radar.loading')} />
      </div>
    );
  }
  if (!usable || status === 'unavailable') {
    return (
      <div className={frameClass}>
        <Message text={t('weather.radar.unavailable')} />
      </div>
    );
  }
  if (!doc || status === 'loading' || status === 'idle') {
    return (
      <div className={frameClass}>
        <Message text={t('weather.radar.loading')} />
      </div>
    );
  }

  const frame = frames[index];
  const kindLabel =
    frame?.kind === 'forecast' ? t('weather.radar.forecast') : t('weather.radar.observed');

  return (
    <div className={`relative flex flex-col gap-1 ${frameClass}`}>
      <div className="relative min-h-0 flex-1">
        <RadarCanvas doc={doc} frames={frames} frameIndex={index} night={night} />
        {frame && (
          <p
            data-testid="frame-label"
            className="absolute left-2 top-2 rounded-full bg-surface-raised/85 px-3 text-caption"
          >
            {t('weather.radar.frame', { time: formatClock(frame.time, timeZone), kind: kindLabel })}
          </p>
        )}
        {radar.status === 'stale' && (
          <p className="absolute right-2 top-2 rounded-full bg-surface-raised/85 px-3 text-caption text-warn">
            {`${t('weather.radar.stale')} · ${formatAge(radarAgeSeconds ?? radar.ageSeconds ?? 0, i18n.language)}`}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 tablet-short:absolute tablet-short:inset-x-2 tablet-short:bottom-1 tablet-short:items-end">
        <div
          aria-label={t('weather.radar.legend')}
          role="img"
          className="flex h-3 w-24 shrink-0 overflow-hidden rounded-full"
        >
          {intensityLegend.map((entry) => (
            <span
              key={entry.mmPerHour}
              className="h-full flex-1"
              style={{ background: legendCss(entry.colour) }}
            />
          ))}
        </div>
        <div className="text-right tablet-short:rounded-full tablet-short:bg-surface-raised/85 tablet-short:px-3">
          <Credits variant="radar" />
        </div>
      </div>
    </div>
  );
}
