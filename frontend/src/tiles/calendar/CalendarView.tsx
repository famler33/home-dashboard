import { useTranslation } from 'react-i18next';
import type { Snapshot, SourceSnapshot } from '../../api/types';
import { applyTab, buildDays, splitKita, visibleEvents, type DayItem } from './agenda';
import { fitRows, type FitResult } from './fit-rows';
import { formatDayDate, formatTime } from './format';
import { dotClass, Legend, type CalendarProblem } from './Legend';
import { mergeCalendars } from './merge';
import type { CalendarTab, TaggedEvent } from './types';
import { isCalendarSettings } from './types';
import { useFittingRows } from './useFittingRows';

interface Props {
  snapshot: Snapshot;
  now: number;
  layout: 'tablet' | 'phone';
  tab: CalendarTab;
  /** Rows that fit; `null` shows everything, `undefined` measures the body. */
  budget?: number | null;
}

function problemOf(
  entry: SourceSnapshot | undefined,
  now: number,
  serverTime: number,
): CalendarProblem | null {
  if (!entry || entry.status === 'never-loaded') return { kind: 'never-loaded' };
  if (entry.status === 'error') return { kind: 'unavailable' };
  const age = (entry.ageSeconds ?? 0) + Math.max(0, (now - serverTime) / 1000);
  if (entry.status === 'stale' || age > entry.staleAfterSeconds)
    return { kind: 'stale', ageSeconds: age };
  return null;
}

export function CalendarView({ snapshot, now, layout, tab, budget }: Props) {
  const { t, i18n } = useTranslation();
  const wall = layout === 'tablet';
  const {
    bodyRef,
    probeRef,
    budget: measuredBudget,
  } = useFittingRows(wall && budget === undefined);
  const settings = snapshot.settings.calendar;
  if (!settings || !isCalendarSettings(settings)) return null;

  const timeZone = snapshot.settings.timezone;
  const entries = snapshot.sources.filter((source) => source.id.startsWith('calendar-'));
  const tagged = mergeCalendars(entries, settings);
  const visible = visibleEvents(applyTab(tagged, tab), now, timeZone);
  const { kita, days } = splitKita(buildDays(visible, now, timeZone), {
    keyword: settings.kitaKeyword,
    tab,
  });
  const noEvents = kita.length === 0 && days.every((group) => group.items.length === 0);
  const effectiveBudget = budget === undefined ? measuredBudget : budget;
  const fit: FitResult | null =
    wall && effectiveBudget !== null
      ? fitRows(
          {
            kita: kita.length,
            days: days.map((group) => ({
              date: group.date,
              rows: Math.max(1, group.items.length),
              isToday: group.kind === 'today',
            })),
          },
          effectiveBudget,
        )
      : null;

  const serverTime = Date.parse(snapshot.serverTime);
  const withProblems = settings.calendars.map((info) => ({
    info,
    problem: problemOf(
      entries.find((entry) => entry.id === `calendar-${info.id}`),
      now,
      serverTime,
    ),
  }));
  const legendEntries =
    tab === 'all'
      ? withProblems
      : withProblems.filter((entry) => entry.info.id === tab && entry.problem);
  const activeName = settings.calendars.find((info) => info.id === tab)?.name ?? '';
  const emphasis = tab === 'all';

  const row = (event: TaggedEvent, part: DayItem['part'], key: string, testId = 'event-row') => {
    const strong = !emphasis || event.role === 'family';
    return (
      <li
        key={key}
        data-testid={testId}
        data-title={event.title}
        data-calendar={event.calendar}
        className={`flex items-baseline gap-3 ${
          strong ? 'text-body text-ink' : 'text-caption text-ink-muted'
        } ${emphasis && event.role === 'family' ? 'font-semibold' : strong ? 'font-medium' : ''}`}
      >
        <span className="min-w-[5.5em] shrink-0 tabular-nums">
          {event.allDay && !(part && part.index > 1)
            ? t('calendar.allDay')
            : part && part.index > 1
              ? t('calendar.part', { index: part.index, total: part.total })
              : formatTime(event.start, timeZone)}
        </span>
        <span
          aria-hidden="true"
          data-testid="calendar-dot"
          className={`h-3 w-3 shrink-0 self-center rounded-full ${dotClass[event.color]}`}
        />
        <span className="sr-only">{`${event.calendarName}: `}</span>
        <span
          data-testid="event-title"
          title={event.title}
          className={`min-w-0 ${wall ? 'truncate' : 'line-clamp-2'} ${event.tentative ? 'italic' : ''}`}
        >
          {event.title || t('calendar.untitled')}
        </span>
        {event.tentative && <span className="sr-only">{`(${t('calendar.tentative')})`}</span>}
      </li>
    );
  };

  const dayLabel = (kind: 'today' | 'tomorrow' | 'date', date: string) =>
    kind === 'today'
      ? t('calendar.today')
      : kind === 'tomorrow'
        ? t('calendar.tomorrow')
        : formatDayDate(date, i18n.language);

  const shownKita = fit ? fit.kita : kita.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Legend calendars={legendEntries} />
      <div ref={bodyRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          ref={probeRef}
          className="invisible absolute inset-x-0 top-0 -z-10 py-1 text-body"
        >
          {'M'}
        </div>
        <div key={tab} data-testid="agenda-body" className="view-enter flex flex-col gap-1">
          {noEvents ? (
            <p className="py-3 text-center text-body text-ink-muted">
              {tab === 'all' ? t('calendar.empty') : t('calendar.emptyTab', { name: activeName })}
            </p>
          ) : (
            <>
              {shownKita > 0 && (
                <section
                  data-testid="kita-block"
                  aria-label={t('calendar.kita')}
                  className="rounded-2xl bg-surface px-3 py-1"
                >
                  <h3 className="text-caption font-semibold text-ink-muted">
                    {t('calendar.kita')}
                  </h3>
                  <ul className="flex flex-col">
                    {kita.slice(0, shownKita).map((entry) => (
                      <li
                        key={entry.key}
                        data-testid="kita-row"
                        className="flex items-baseline gap-3 text-body font-semibold text-ink"
                      >
                        <span className="shrink-0 text-ink-muted">
                          {entry.date === days[0]?.date && days[0]?.kind === 'today'
                            ? t('calendar.today')
                            : t('calendar.tomorrow')}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {entry.event.allDay
                            ? t('calendar.allDay')
                            : formatTime(entry.event.start, timeZone)}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`h-3 w-3 shrink-0 self-center rounded-full ${dotClass[entry.event.color]}`}
                        />
                        <span className="min-w-0 truncate" title={entry.event.title}>
                          {entry.event.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {days.map((group, position) => {
                const plan = fit?.days[position];
                if (plan?.hidden) return null;
                const count = group.items.length;
                const heading = dayLabel(group.kind, group.date);
                return (
                  <section key={group.date}>
                    <h3
                      data-testid="day-heading"
                      className="text-caption font-semibold text-ink-muted"
                    >
                      {plan?.collapsed
                        ? `${heading} · ${t('calendar.collapsed', { count })}`
                        : heading}
                    </h3>
                    {!plan?.collapsed && (
                      <ul className="flex flex-col">
                        {count === 0 ? (
                          <li className="text-body text-ink-muted">{t('calendar.noneToday')}</li>
                        ) : (
                          group.items
                            .slice(0, plan ? plan.shown : count)
                            .map((item) => row(item.event, item.part, item.key))
                        )}
                      </ul>
                    )}
                  </section>
                );
              })}
              {fit && fit.more > 0 && (
                <p className="text-caption font-semibold text-ink-muted">
                  {t('calendar.more', { count: fit.more })}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
