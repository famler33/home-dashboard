const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CompassKey = (typeof compass)[number];

/** 24-hour clock time in the given time zone. */
export function formatClock(time: string | number, timeZone: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(time));
}

export function compassKey(degrees: number): CompassKey {
  const normalized = ((degrees % 360) + 360) % 360;
  return compass[Math.floor((normalized + 22.5) / 45) % 8] ?? 'N';
}

export function roundTemperature(value: number): number {
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

/** Short German weekday for a local `YYYY-MM-DD` date. */
export function formatWeekday(date: string, locale: string): string {
  const short = new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : locale, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
  // Some ICU versions drop the abbreviation dot ("Mi"), others keep it ("Mi.").
  return locale === 'de' && !short.endsWith('.') ? `${short}.` : short;
}
