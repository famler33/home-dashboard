import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SourceSnapshot } from '../../api/types';
import { useShell } from '../../shell/shell-context';
import { effectiveAgeSeconds } from '../../snapshot/freshness';
import { useSnapshot } from '../../snapshot/useSnapshot';
import type { TileContentProps } from '../types';
import { AlertBanner, hasActiveAlert } from './AlertBanner';
import { Credits } from './Credits';
import { DaysView } from './DaysView';
import { classifyGesture } from './gestures';
import { NowView } from './NowView';
import { describeRain, pickRainSeries } from './rain';
import { RainView } from './RainView';
import { isWeatherPayload, type WeatherPayload } from './types';
import { useInView } from './useInView';
import { useViewRotation } from './useViewRotation';
import { viewIds, ViewIndicators, type ViewId } from './ViewIndicators';

const DWELL_MS = 15_000;
const RESUME_MS = 60_000;
const FADE_MS = 600;

export function WeatherTile({ data }: TileContentProps) {
  const weather = isWeatherPayload(data) ? data : null;
  if (!weather) return null;
  return <WeatherContent weather={weather} />;
}

function WeatherContent({ weather }: { weather: WeatherPayload }) {
  const { t } = useTranslation();
  const { snapshot, receivedAtMonotonic, nowMono } = useSnapshot();
  const { layout, theme } = useShell();
  const timeZone = snapshot?.settings.timezone ?? 'UTC';
  const entry = (id: string): SourceSnapshot | undefined =>
    snapshot?.sources.find((source) => source.id === id);
  const weatherEntry = entry('weather');
  const radar = entry('weather-radar');
  const alerts = entry('weather-alerts');
  // Server time plus the monotonic time since receipt: stays independent of the tablet's clock.
  const now =
    snapshot && receivedAtMonotonic !== null
      ? Date.parse(snapshot.serverTime) + Math.max(0, nowMono - receivedAtMonotonic)
      : 0;
  const ageOf = (source: SourceSnapshot | undefined): number | null =>
    source && receivedAtMonotonic !== null
      ? effectiveAgeSeconds(source, receivedAtMonotonic, nowMono)
      : (source?.ageSeconds ?? null);

  const picked = pickRainSeries(radar, weatherEntry, now);
  const statement = picked ? describeRain(picked.steps, picked.stepMin, now) : null;
  const night = theme === 'night';
  const alertBanner = (
    <AlertBanner
      alerts={alerts}
      weatherLoaded={weatherEntry?.status !== 'never-loaded'}
      now={now}
      timeZone={timeZone}
    />
  );

  const render = (id: ViewId, mode: 'wall' | 'phone', active: boolean): ReactNode => {
    switch (id) {
      case 'now':
        return (
          <NowView
            weather={weather}
            rain={statement}
            layout={mode}
            timeZone={timeZone}
            alertActive={hasActiveAlert(alerts, now)}
          />
        );
      case 'days':
        return <DaysView weather={weather} layout={mode} />;
      case 'rain':
        return (
          <RainView
            weather={weatherEntry}
            radar={radar}
            radarAgeSeconds={ageOf(radar)}
            layout={mode}
            active={active}
            night={night}
            now={now}
            timeZone={timeZone}
          />
        );
    }
  };

  if (layout === 'phone') {
    return <PhoneStack render={render} alertBanner={alertBanner} t={t} />;
  }
  return (
    <WallViews
      render={render}
      alertBanner={alertBanner}
      autoplay={weatherEntry?.status === 'fresh'}
    />
  );
}

type RenderView = (id: ViewId, mode: 'wall' | 'phone', active: boolean) => ReactNode;

function PhoneStack({
  render,
  alertBanner,
  t,
}: {
  render: RenderView;
  alertBanner: ReactNode;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const rainRef = useRef<HTMLElement>(null);
  const rainVisible = useInView(rainRef);
  return (
    <div className="flex flex-col gap-4">
      {alertBanner}
      <section aria-label={t('weather.views.now')}>{render('now', 'phone', true)}</section>
      <section aria-label={t('weather.views.days')}>{render('days', 'phone', true)}</section>
      <section ref={rainRef} aria-label={t('weather.views.rain')}>
        {render('rain', 'phone', rainVisible)}
      </section>
      <Credits variant="full" />
    </div>
  );
}

function WallViews({
  render,
  alertBanner,
  autoplay,
}: {
  render: RenderView;
  alertBanner: ReactNode;
  autoplay: boolean;
}) {
  const rotation = useViewRotation({
    viewCount: viewIds.length,
    dwellMs: DWELL_MS,
    resumeMs: RESUME_MS,
    autoplay,
  });
  const { index } = rotation;

  // Keep the outgoing view mounted for the length of the fade.
  const [stage, setStage] = useState<{ current: number; previous: number | null }>({
    current: index,
    previous: null,
  });
  if (stage.current !== index) setStage({ current: index, previous: stage.current });
  useEffect(() => {
    if (stage.previous === null) return undefined;
    const timer = setTimeout(() => setStage((s) => ({ ...s, previous: null })), FADE_MS);
    return () => clearTimeout(timer);
  }, [stage.previous]);

  const pressed = useRef<{ x: number; y: number } | null>(null);
  const onDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.isPrimary === false) return;
    pressed.current = { x: event.clientX, y: event.clientY };
  };
  const onUp = (event: PointerEvent<HTMLDivElement>): void => {
    const start = pressed.current;
    pressed.current = null;
    if (!start) return;
    const gesture = classifyGesture({ dx: event.clientX - start.x, dy: event.clientY - start.y });
    if (gesture === 'tap' || gesture === 'swipe-left') rotation.next();
    else if (gesture === 'swipe-right') rotation.prev();
  };

  const layers = [stage.previous, stage.current].filter((value): value is number => value !== null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1">
      {alertBanner}
      <div
        data-testid="view-surface"
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (pressed.current = null)}
      >
        {layers.map((position) => {
          const id = viewIds[position]!;
          const active = position === stage.current;
          return (
            <div
              key={id}
              data-view={id}
              data-view-active={active}
              aria-hidden={!active}
              className={`absolute inset-0 ${active ? 'view-enter' : 'view-exit'}`}
            >
              {render(id, 'wall', active)}
            </div>
          );
        })}
      </div>
      {viewIds[stage.current] === 'rain' ? null : <Credits variant="short" />}
      <div className="absolute right-2 top-0 z-10">
        <ViewIndicators index={index} onSelect={rotation.goTo} />
      </div>
    </div>
  );
}
