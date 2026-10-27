import type { SourceState } from '../cache/snapshot-store.js';

export type SourceStatus = 'never-loaded' | 'fresh' | 'stale' | 'error';

export function deriveStatus(
  state: SourceState | undefined,
  staleAfterSeconds: number,
  now: number,
): SourceStatus {
  if (!state || (state.lastSuccessAt === null && state.lastAttemptAt === null)) {
    return 'never-loaded';
  }
  if (state.lastSuccessAt === null) return 'error';
  return now - state.lastSuccessAt > staleAfterSeconds * 1000 ? 'stale' : 'fresh';
}
