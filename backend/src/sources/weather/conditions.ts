export type ConditionId =
  | 'clear'
  | 'mostly-clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'showers'
  | 'snow'
  | 'thunderstorm'
  | 'unknown';

export const conditionIds: readonly ConditionId[] = [
  'clear',
  'mostly-clear',
  'partly-cloudy',
  'overcast',
  'fog',
  'drizzle',
  'rain',
  'showers',
  'snow',
  'thunderstorm',
  'unknown',
];

/** WMO weather interpretation codes as used by Open-Meteo. */
export function wmoToCondition(code: number | null | undefined): ConditionId {
  if (typeof code !== 'number' || !Number.isInteger(code)) return 'unknown';
  if (code === 0) return 'clear';
  if (code === 1) return 'mostly-clear';
  if (code === 2) return 'partly-cloudy';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'unknown';
}
