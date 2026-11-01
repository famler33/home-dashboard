import { relativeAge } from '../../snapshot/freshness';

export type AgeText = { kind: 'justNow' } | { kind: 'text'; text: string };

/** Age of a headline from its publication time: "vor 12 Min." up to 24 h, then a German date. */
export function describeAge(
  publishedAt: string,
  now: number,
  locale: string,
  timeZone: string,
): AgeText {
  const intlLocale = locale === 'de' ? 'de-DE' : locale;
  const published = Date.parse(publishedAt);
  const seconds = Math.max(0, (now - published) / 1000);
  const age = relativeAge(seconds);
  if (age.kind === 'justNow') return { kind: 'justNow' };
  if (age.unit === 'day') {
    return {
      kind: 'text',
      text: new Intl.DateTimeFormat(intlLocale, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        timeZone,
      }).format(new Date(published)),
    };
  }
  return {
    kind: 'text',
    text: new Intl.RelativeTimeFormat(intlLocale, { numeric: 'always', style: 'short' }).format(
      age.value,
      age.unit,
    ),
  };
}
