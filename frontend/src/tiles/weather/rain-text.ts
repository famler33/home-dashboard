import type { TFunction } from 'i18next';
import { formatClock } from './format';
import type { RainStatement } from './rain';

/** German sentence for a rain statement; the short form fits one line on small wall screens. */
export function rainText(
  t: TFunction,
  timeZone: string,
  statement: RainStatement,
  short = false,
): string {
  switch (statement.kind) {
    case 'none':
      return short ? t('weather.rain.noneShort') : t('weather.rain.none');
    case 'starts': {
      const values = {
        time: formatClock(statement.startsAt, timeZone),
        minutes: statement.durationMin,
      };
      if (short) {
        return t(
          statement.beyondHorizon ? 'weather.rain.startsAtLeastShort' : 'weather.rain.startsShort',
          values,
        );
      }
      return t(
        statement.beyondHorizon ? 'weather.rain.startsAtLeast' : 'weather.rain.starts',
        values,
      );
    }
    case 'raining':
      if (statement.endsAt === null) {
        const time = formatClock(statement.horizonEnd, timeZone);
        return t(short ? 'weather.rain.rainingLongShort' : 'weather.rain.rainingLong', { time });
      }
      return t(short ? 'weather.rain.rainingShort' : 'weather.rain.raining', {
        time: formatClock(statement.endsAt, timeZone),
      });
  }
}
