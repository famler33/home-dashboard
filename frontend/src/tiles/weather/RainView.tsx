import { useTranslation } from 'react-i18next';
import type { SourceSnapshot } from '../../api/types';
import { conditionLabelKey } from './conditions';
import { roundTemperature } from './format';
import { describeRain, pickRainSeries, toBars } from './rain';
import { rainText } from './rain-text';
import { RadarView } from './RadarView';
import { isWeatherPayload } from './types';
import { WeatherSymbol } from './WeatherSymbol';

interface Props {
  weather: SourceSnapshot | undefined;
  radar: SourceSnapshot | undefined;
  radarAgeSeconds: number | null;
  layout: 'wall' | 'phone';
  active: boolean;
  night: boolean;
  now: number;
  timeZone: string;
  fetchImpl?: typeof fetch;
}

const SCALE_MM_H = 4;

export function RainView({
  weather,
  radar,
  radarAgeSeconds,
  layout,
  active,
  night,
  now,
  timeZone,
  fetchImpl,
}: Props) {
  const { t } = useTranslation();
  const picked = pickRainSeries(radar, weather, now);
  const statement = picked ? describeRain(picked.steps, picked.stepMin, now) : null;
  const text = statement ? rainText(t, timeZone, statement) : t('weather.rain.unavailable');
  const bars = picked
    ? toBars(picked.steps, picked.stepMin).filter((bar) => bar.time + 15 * 60_000 > now)
    : [];
  const wall = layout === 'wall';
  const current = wall && isWeatherPayload(weather?.data) ? weather.data.current : null;

  return (
    <div className={`flex min-h-0 flex-col gap-2 ${wall ? 'h-full' : ''}`}>
      <div className={`flex items-center gap-3 ${wall ? '' : 'flex-col items-stretch'}`}>
        <p data-testid="rain-statement" className="min-w-0 flex-1 text-caption text-accent">
          {text}
        </p>
        {bars.length > 0 && (
          <svg
            data-testid="rain-bars"
            data-source={picked?.source}
            data-bar-count={bars.length}
            role="img"
            aria-label={`${t('weather.rain.chart')}: ${text}`}
            viewBox={`0 0 ${bars.length * 8} 24`}
            preserveAspectRatio="none"
            className={wall ? 'h-9 w-28 shrink-0' : 'h-16 w-full'}
          >
            {bars.map((bar, position) => {
              const height = Math.max(
                bar.mmPerHour > 0 ? 2 : 1,
                Math.min(bar.mmPerHour / SCALE_MM_H, 1) * 24,
              );
              return (
                <rect
                  key={bar.time}
                  data-mm={bar.mmPerHour.toFixed(2)}
                  x={position * 8 + 1}
                  y={24 - height}
                  width={6}
                  height={height}
                  rx={1}
                  className={bar.mmPerHour >= 0.1 ? 'fill-accent' : 'fill-ink-muted opacity-40'}
                />
              );
            })}
          </svg>
        )}
      </div>
      <div className={`relative min-h-0 ${wall ? 'flex-1' : ''}`}>
        {current && (
          <p
            data-testid="rain-now"
            className={`absolute right-2 z-10 flex items-center gap-2 rounded-full bg-surface-raised/85 px-3 tablet-short:bottom-8 tablet-short:left-2 tablet-short:right-auto tablet-short:top-auto ${radar?.status === 'stale' ? 'top-14' : 'top-2'}`}
          >
            <WeatherSymbol
              condition={current.condition}
              isDay={current.isDay}
              label={t(conditionLabelKey(current.condition))}
              className="h-[1.25em] w-[1.25em] shrink-0 text-title"
            />
            <span className="text-title tabular-nums">{`${roundTemperature(current.temperature)}°`}</span>
          </p>
        )}
        <RadarView
          radar={radar}
          radarAgeSeconds={radarAgeSeconds}
          layout={layout}
          active={active}
          night={night}
          timeZone={timeZone}
          {...(fetchImpl ? { fetchImpl } : {})}
        />
      </div>
    </div>
  );
}
