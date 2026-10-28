import { useTranslation } from 'react-i18next';
import { conditionLabelKey } from './conditions';
import { formatWeekday, roundTemperature } from './format';
import { SHOW_PROBABILITY_FROM } from './NowView';
import type { WeatherPayload } from './types';
import { WeatherSymbol } from './WeatherSymbol';

export function DaysView({
  weather,
  layout,
}: {
  weather: WeatherPayload;
  layout: 'wall' | 'phone';
}) {
  const { t, i18n } = useTranslation();
  const wall = layout === 'wall';

  return (
    <ul
      className={wall ? 'grid h-full grid-cols-7 gap-1' : 'flex flex-col gap-2'}
      aria-label={t('weather.views.days')}
    >
      {weather.daily.map((day, index) => (
        <li
          key={day.date}
          data-testid="day"
          className={`flex text-caption ${wall ? 'flex-col items-center justify-between' : 'items-center gap-3'}`}
        >
          {index === 0 && wall ? (
            <span className="font-semibold text-ink">
              <span aria-hidden="true">{formatWeekday(day.date, i18n.language)}</span>
              <span className="sr-only">{t('weather.today')}</span>
            </span>
          ) : (
            <span className={`${wall ? '' : 'w-24'} text-ink-muted`}>
              {index === 0 ? t('weather.today') : formatWeekday(day.date, i18n.language)}
            </span>
          )}
          <span className="tablet-short:sr-only">
            <WeatherSymbol
              condition={day.condition}
              isDay
              label={t(conditionLabelKey(day.condition))}
              className="h-[1.6em] w-[1.6em]"
            />
          </span>
          <span className={wall ? 'flex flex-col items-center' : 'flex gap-2'}>
            <span className="font-medium">{`${roundTemperature(day.max)}°`}</span>
            <span className="text-ink-muted">{`${roundTemperature(day.min)}°`}</span>
          </span>
          {day.precipProbability >= SHOW_PROBABILITY_FROM ? (
            <span className="text-accent">
              {t(wall ? 'weather.probabilityCompact' : 'weather.probability', {
                value: Math.round(day.precipProbability),
              })}
            </span>
          ) : (
            wall && <span aria-hidden="true">&nbsp;</span>
          )}
        </li>
      ))}
    </ul>
  );
}
