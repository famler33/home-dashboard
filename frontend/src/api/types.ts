export type SourceStatus = 'never-loaded' | 'fresh' | 'stale' | 'error';
export type SourceErrorCode = 'SOURCE_FETCH_FAILED' | 'SOURCE_TIMEOUT';

export interface SourceSnapshot {
  id: string;
  status: SourceStatus;
  data: unknown;
  lastUpdated: string | null;
  ageSeconds: number | null;
  staleAfterSeconds: number;
  lastErrorCode: SourceErrorCode | null;
}

export interface SnapshotSettings {
  timezone: string;
  display: { nightFrom: string; nightTo: string; dailyReloadAt: string };
  /** Present when the calendar tile is enabled: names, colours and roles, never addresses. */
  calendar?: {
    kitaKeyword: string;
    calendars: {
      id: 'family' | 'person-1' | 'person-2';
      name: string;
      color: 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'rose';
      role: 'family' | 'person';
    }[];
  };
}

export interface Snapshot {
  buildId: string;
  serverTime: string;
  settings: SnapshotSettings;
  sources: SourceSnapshot[];
}

const statuses: readonly string[] = ['never-loaded', 'fresh', 'stale', 'error'];
const errorCodes: readonly (string | null)[] = ['SOURCE_FETCH_FAILED', 'SOURCE_TIMEOUT', null];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSource(value: unknown): value is SourceSnapshot {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['status'] === 'string' &&
    statuses.includes(value['status']) &&
    'data' in value &&
    (value['lastUpdated'] === null || typeof value['lastUpdated'] === 'string') &&
    (value['ageSeconds'] === null || typeof value['ageSeconds'] === 'number') &&
    typeof value['staleAfterSeconds'] === 'number' &&
    errorCodes.includes(value['lastErrorCode'] as string | null)
  );
}

export function isSnapshot(value: unknown): value is Snapshot {
  if (!isRecord(value)) return false;
  const settings = value['settings'];
  const display = isRecord(settings) ? settings['display'] : undefined;
  return (
    typeof value['buildId'] === 'string' &&
    typeof value['serverTime'] === 'string' &&
    isRecord(settings) &&
    typeof settings['timezone'] === 'string' &&
    isRecord(display) &&
    typeof display['nightFrom'] === 'string' &&
    typeof display['nightTo'] === 'string' &&
    typeof display['dailyReloadAt'] === 'string' &&
    Array.isArray(value['sources']) &&
    value['sources'].every(isSource)
  );
}
