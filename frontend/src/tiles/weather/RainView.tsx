import { useTranslation } from 'react-i18next';
import type { SourceSnapshot } from '../../api/types';
import { describeRain, pickRainSeries, toBars } from './rain';
import { rainText } from './rain-text';
import { RadarView } from './RadarView';

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
      <div className={`min-h-0 ${wall ? 'flex-1' : ''}`}>
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
