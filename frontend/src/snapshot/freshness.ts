import type { SourceSnapshot } from '../api/types';

export type TileStatus = 'loading' | 'never-loaded' | 'empty' | 'fresh' | 'stale' | 'error';

/** Server age plus the monotonic time since receipt: independent of the device wall clock. */
export function effectiveAgeSeconds(
  source: SourceSnapshot,
  receivedAt: number,
  nowMono: number,
): number | null {
  if (source.ageSeconds === null) return null;
  return source.ageSeconds + Math.max(0, (nowMono - receivedAt) / 1000);
}

export function deriveTileStatus(args: {
  source: SourceSnapshot | undefined;
  snapshotPresent: boolean;
  receivedAt: number | null;
  nowMono: number;
  isEmpty: (data: unknown) => boolean;
}): TileStatus {
  const { source, snapshotPresent, receivedAt, nowMono, isEmpty } = args;
  if (!snapshotPresent) return 'loading';
  if (!source || source.status === 'never-loaded') return 'never-loaded';
  if (source.status === 'error') return 'error';

  const age =
    receivedAt === null ? source.ageSeconds : effectiveAgeSeconds(source, receivedAt, nowMono);
  if (source.status === 'stale' || (age !== null && age > source.staleAfterSeconds)) return 'stale';
  if (source.data === null || isEmpty(source.data)) return 'empty';
  return 'fresh';
}

export type RelativeAge =
  | { kind: 'justNow' }
  | { kind: 'relative'; value: number; unit: 'second' | 'minute' | 'hour' | 'day' };

export function relativeAge(seconds: number): RelativeAge {
  if (seconds < 15) return { kind: 'justNow' };
  if (seconds < 60) return { kind: 'relative', value: -Math.floor(seconds), unit: 'second' };
  if (seconds < 3600) return { kind: 'relative', value: -Math.floor(seconds / 60), unit: 'minute' };
  if (seconds < 86400)
    return { kind: 'relative', value: -Math.floor(seconds / 3600), unit: 'hour' };
  return { kind: 'relative', value: -Math.floor(seconds / 86400), unit: 'day' };
}
