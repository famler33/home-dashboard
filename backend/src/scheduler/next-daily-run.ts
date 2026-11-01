const DAY_MS = 86_400_000;

function wallClock(
  utcMs: number,
  timeZone: string,
): { y: number; m: number; d: number; h: number; min: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(utcMs));
  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') };
}

function offsetMs(utcMs: number, timeZone: string): number {
  const w = wallClock(utcMs, timeZone);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.min);
  return asUtc - Math.floor(utcMs / 60_000) * 60_000;
}

function firstInstantFor(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  timeZone: string,
): number {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const candidates = [
    guess - offsetMs(guess - DAY_MS, timeZone),
    guess - offsetMs(guess + DAY_MS, timeZone),
  ];
  const valid = candidates.filter((utc) => {
    const w = wallClock(utc, timeZone);
    return w.y === y && w.m === m && w.d === d && w.h === h && w.min === min;
  });
  // Inside a daylight-saving gap no instant matches: use the pre-transition offset.
  // A repeated hour counts once per day: the first occurrence wins.
  return valid.length > 0 ? Math.min(...valid) : (candidates[0] as number);
}

/** Next instant strictly after `nowMs` at which the wall clock in `timeZone` shows `hhmm`. */
export function nextDailyRun(nowMs: number, hhmm: string, timeZone: string): number {
  const [hourText, minuteText] = hhmm.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const today = wallClock(nowMs, timeZone);

  for (let offset = 0; offset <= 2; offset += 1) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d + offset));
    const instant = firstInstantFor(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      hour,
      minute,
      timeZone,
    );
    if (instant > nowMs) return instant;
  }
  throw new Error('could not compute the next daily run');
}
