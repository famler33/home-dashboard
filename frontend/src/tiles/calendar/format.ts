/** `HH:mm` (24 hours) of an ISO instant in the household time zone. */
export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(iso));
}

/** "Sa. 31.10." for a local `YYYY-MM-DD` date. */
export function formatDayDate(date: string, locale: string): string {
  const text = new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(',', '');
  const [weekday, rest = ''] = text.split(' ');
  const dotted = weekday?.endsWith('.') ? weekday : `${weekday}.`;
  return `${dotted} ${rest}`.trim();
}

/** The local `YYYY-MM-DD` date of an instant in a time zone. */
export function localDate(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
