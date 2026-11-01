import type { SnapshotStore } from '../cache/snapshot-store.js';
import type { SnapshotSettings } from '../config/schema.js';
import type { Source } from '../sources/source.js';
import { deriveStatus } from './derive-status.js';
import type { Snapshot } from './schema.js';

export function buildSnapshot(input: {
  sources: readonly Source[];
  store: SnapshotStore;
  settings: SnapshotSettings;
  buildId: string;
  now: number;
}): Snapshot {
  const { sources, store, settings, buildId, now } = input;

  const entries = [...sources]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((source) => {
      const state = store.get(source.id);
      const lastSuccessAt = state?.lastSuccessAt ?? null;
      return {
        id: source.id,
        status: deriveStatus(state, source.staleAfterSeconds, now),
        data: state?.payload ?? null,
        lastUpdated: lastSuccessAt === null ? null : new Date(lastSuccessAt).toISOString(),
        ageSeconds:
          lastSuccessAt === null ? null : Math.max(0, Math.floor((now - lastSuccessAt) / 1000)),
        staleAfterSeconds: source.staleAfterSeconds,
        lastErrorCode: state?.lastErrorCode ?? null,
      };
    });

  return { buildId, serverTime: new Date(now).toISOString(), settings, sources: entries };
}
