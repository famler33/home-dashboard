import type { ParseKeys } from 'i18next';

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

export type SymbolKind =
  'clear' | 'partly-cloudy' | 'overcast' | 'fog' | 'rain' | 'thunderstorm' | 'snow' | 'unknown';

const symbols: Record<ConditionId, SymbolKind> = {
  clear: 'clear',
  'mostly-clear': 'clear',
  'partly-cloudy': 'partly-cloudy',
  overcast: 'overcast',
  fog: 'fog',
  drizzle: 'rain',
  rain: 'rain',
  showers: 'rain',
  snow: 'snow',
  thunderstorm: 'thunderstorm',
  unknown: 'unknown',
};

export function symbolKind(condition: ConditionId): SymbolKind {
  return symbols[condition];
}

export function conditionLabelKey(condition: ConditionId): ParseKeys {
  return `weather.conditions.${condition}`;
}
