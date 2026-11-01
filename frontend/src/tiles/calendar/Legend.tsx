import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAge } from '../weather/format';
import type { CalendarColor, CalendarInfo } from './types';

export const dotClass: Record<CalendarColor, string> = {
  blue: 'bg-cal-blue',
  green: 'bg-cal-green',
  orange: 'bg-cal-orange',
  purple: 'bg-cal-purple',
  teal: 'bg-cal-teal',
  rose: 'bg-cal-rose',
};

export type CalendarProblem =
  { kind: 'stale'; ageSeconds: number } | { kind: 'never-loaded' } | { kind: 'unavailable' };

interface Props {
  calendars: readonly { info: CalendarInfo; problem: CalendarProblem | null }[];
}

/** Colour chips with the calendar names; a calendar with a problem says so in text on its own chip. */
export function Legend({ calendars }: Props) {
  const { t, i18n } = useTranslation();
  if (calendars.length === 0) return null;
  return (
    <ul
      data-testid="legend"
      aria-label={t('calendar.legend')}
      className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted"
    >
      {calendars.map(({ info, problem }) => (
        <li key={info.id} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`h-3 w-3 shrink-0 rounded-full ${dotClass[info.color]}`}
          />
          <span className={problem ? '' : 'tablet-short:sr-only'}>{info.name}</span>
          {problem && (
            <span className="flex items-center gap-1 text-warn">
              <Clock aria-hidden="true" className="h-[1em] w-[1em] shrink-0" />
              {problem.kind === 'stale'
                ? t('calendar.stale', { age: formatAge(problem.ageSeconds, i18n.language) })
                : problem.kind === 'never-loaded'
                  ? t('calendar.neverLoaded')
                  : t('calendar.unavailable')}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
