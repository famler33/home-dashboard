import { useTranslation } from 'react-i18next';
import { conditionLabelKey } from './conditions';
import { compassKey, formatClock, roundTemperature } from './format';
import type { RainStatement } from './rain';
import { rainText } from './rain-text';
import type { WeatherPayload } from './types';
import { WeatherSymbol } from './WeatherSymbol';

export const NOTABLE_WIND_KMH = 40;
export const SHOW_PROBABILITY_FROM = 20;

interface Props {
  weather: WeatherPayload;
  rain: RainStatement | null;
  layout: 'wall' | 'phone';
  timeZone: string;
  /** A warning is shown: on short screens it takes the place of the hourly strip. */
  alertActive?: boolean;
}

export function NowView({ weather, rain, layout, timeZone, alertActive = false }: Props) {
  const { t } = useTranslation();
  const { current, today } = weather;
  const wall = layout === 'wall';
  const label = t(conditionLabelKey(current.condition));
  const dayLine =
    t('weather.dayLine', { min: roundTemperature(today.min), max: roundTemperature(today.max) }) +
    t('weather.dayLineRain', { probability: Math.round(today.precipProbability) });
  const showWind = !wall || current.windKmh >= NOTABLE_WIND_KMH;
  const slots = weather.hourly.slice(0, wall ? 5 : 24);

  return (
    <div className="flex h-full min-h-0 flex-col justify-between gap-2">
      <div className="flex min-h-0 flex-col gap-1">
        <div className="flex items-center gap-4">
          <WeatherSymbol
            condition={current.condition}
            isDay={current.isDay}
            label={label}
            className="h-[1.25em] w-[1.25em] shrink-0 text-display"
          />
          <p className="text-display tabular-nums">{`${roundTemperature(current.temperature)}°`}</p>
          <div className="flex min-w-0 flex-col">
            <p className="text-title tablet-short:text-body">{label}</p>
            <p className="text-caption text-ink-muted">{dayLine}</p>
          </div>
        </div>
        {showWind && (
          <p className="text-caption text-ink-muted">
            {t('weather.wind', {
              speed: Math.round(current.windKmh),
              direction: t(`weather.compass.${compassKey(current.windDirection)}`),
            })}
          </p>
        )}
        {rain && (
          <p data-testid="rain-line" className="text-caption text-accent">
            {rainText(t, timeZone, rain)}
          </p>
        )}
      </div>

      <ul
        data-testid="hour-strip"
        className={`grid gap-2 ${wall ? 'grid-cols-5' : 'grid-cols-4'} ${wall && alertActive ? 'tablet-short:hidden' : ''}`}
      >
        {slots.map((slot) => (
          <li
            key={slot.time}
            data-testid="hour-slot"
            className="flex flex-col items-center text-caption"
          >
            <span className="text-ink-muted">{formatClock(slot.time, timeZone)}</span>
            <span className="tablet-short:sr-only">
              <WeatherSymbol
                condition={slot.condition}
                isDay={slot.isDay}
                label={t(conditionLabelKey(slot.condition))}
                className="h-[1.4em] w-[1.4em]"
              />
            </span>
            <span className="font-medium">{`${roundTemperature(slot.temperature)}°`}</span>
            {slot.precipProbability >= SHOW_PROBABILITY_FROM && (
              <span className="text-accent">
                {t('weather.probability', { value: Math.round(slot.precipProbability) })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
