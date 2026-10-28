import type { ConditionId } from './conditions';
import { conditionIds } from './conditions';

export interface WeatherPayload {
  location: { name: string };
  current: {
    temperature: number;
    condition: ConditionId;
    isDay: boolean;
    windKmh: number;
    windDirection: number;
  };
  today: { max: number; min: number; precipProbability: number };
  hourly: {
    time: string;
    temperature: number;
    condition: ConditionId;
    isDay: boolean;
    precipProbability: number;
  }[];
  daily: {
    date: string;
    max: number;
    min: number;
    condition: ConditionId;
    precipProbability: number;
  }[];
  rainSeries: { time: string; mmPerHour: number }[];
}

export interface RadarPayload {
  version: string;
  frames: { time: string; kind: 'observed' | 'forecast' }[];
  homeSeries: { time: string; mmPerHour: number }[];
}

export type AlertSeverity = 'minor' | 'moderate' | 'severe' | 'extreme';

export interface AlertsPayload {
  alerts: { id: string; type: string; severity: AlertSeverity; onset: string; expires: string }[];
}

export interface RadarDocument {
  version: string;
  size: number;
  corners: [number, number][];
  home: { col: number; row: number; lat: number; lon: number };
  map: { zoom: number; tileSize: number; tiles: { x: number; y: number }[] };
  frames: { time: string; kind: 'observed' | 'forecast'; values: string }[];
}

type Rec = Record<string, unknown>;
const isRec = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNum = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isStr = (value: unknown): value is string => typeof value === 'string';
const isCondition = (value: unknown): value is ConditionId =>
  isStr(value) && (conditionIds as readonly string[]).includes(value);
const every = (value: unknown, check: (item: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(check);

export function isWeatherPayload(value: unknown): value is WeatherPayload {
  if (!isRec(value)) return false;
  const { location, current, today } = value;
  return (
    isRec(location) &&
    isStr(location['name']) &&
    isRec(current) &&
    isNum(current['temperature']) &&
    isCondition(current['condition']) &&
    typeof current['isDay'] === 'boolean' &&
    isNum(current['windKmh']) &&
    isNum(current['windDirection']) &&
    isRec(today) &&
    isNum(today['max']) &&
    isNum(today['min']) &&
    isNum(today['precipProbability']) &&
    every(
      value['hourly'],
      (item) =>
        isRec(item) &&
        isStr(item['time']) &&
        isNum(item['temperature']) &&
        isCondition(item['condition']) &&
        typeof item['isDay'] === 'boolean' &&
        isNum(item['precipProbability']),
    ) &&
    every(
      value['daily'],
      (item) =>
        isRec(item) &&
        isStr(item['date']) &&
        isNum(item['max']) &&
        isNum(item['min']) &&
        isCondition(item['condition']) &&
        isNum(item['precipProbability']),
    ) &&
    every(
      value['rainSeries'],
      (item) => isRec(item) && isStr(item['time']) && isNum(item['mmPerHour']),
    )
  );
}

export function isRadarPayload(value: unknown): value is RadarPayload {
  return (
    isRec(value) &&
    isStr(value['version']) &&
    every(
      value['frames'],
      (item) =>
        isRec(item) &&
        isStr(item['time']) &&
        (item['kind'] === 'observed' || item['kind'] === 'forecast'),
    ) &&
    every(
      value['homeSeries'],
      (item) => isRec(item) && isStr(item['time']) && isNum(item['mmPerHour']),
    )
  );
}

const severities: readonly string[] = ['minor', 'moderate', 'severe', 'extreme'];

export function isAlertsPayload(value: unknown): value is AlertsPayload {
  return (
    isRec(value) &&
    every(
      value['alerts'],
      (item) =>
        isRec(item) &&
        isStr(item['id']) &&
        isStr(item['type']) &&
        isStr(item['severity']) &&
        severities.includes(item['severity']) &&
        isStr(item['onset']) &&
        isStr(item['expires']),
    )
  );
}

export function isRadarDocument(value: unknown): value is RadarDocument {
  if (!isRec(value)) return false;
  const { size, home, map } = value;
  if (!isNum(size) || !isRec(home) || !isRec(map)) return false;
  return (
    isStr(value['version']) &&
    every(
      value['corners'],
      (item) => Array.isArray(item) && item.length === 2 && isNum(item[0]) && isNum(item[1]),
    ) &&
    (value['corners'] as unknown[]).length === 4 &&
    isNum(home['col']) &&
    isNum(home['row']) &&
    isNum(home['lat']) &&
    isNum(home['lon']) &&
    isNum(map['zoom']) &&
    isNum(map['tileSize']) &&
    every(map['tiles'], (item) => isRec(item) && isNum(item['x']) && isNum(item['y'])) &&
    every(
      value['frames'],
      (item) =>
        isRec(item) &&
        isStr(item['time']) &&
        (item['kind'] === 'observed' || item['kind'] === 'forecast') &&
        isStr(item['values']) &&
        item['values'].length >= Math.ceil((size * size) / 3) * 4 - 2,
    )
  );
}
