import type { TFunction } from 'i18next';
import { formatClock } from './format';
import type { RainStatement } from './rain';

/** German sentence for a rain statement. */
export function rainText(t: TFunction, timeZone: string, statement: RainStatement): string {
  switch (statement.kind) {
    case 'none':
      return t('weather.rain.none');
    case 'starts':
      return t(statement.beyondHorizon ? 'weather.rain.startsAtLeast' : 'weather.rain.starts', {
        time: formatClock(statement.startsAt, timeZone),
        minutes: statement.durationMin,
      });
    case 'raining':
      return statement.endsAt === null
        ? t('weather.rain.rainingLong', { time: formatClock(statement.horizonEnd, timeZone) })
        : t('weather.rain.raining', { time: formatClock(statement.endsAt, timeZone) });
  }
}
