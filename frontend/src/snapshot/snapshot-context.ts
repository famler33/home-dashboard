import { createContext } from 'react';
import type { Snapshot } from '../api/types';

export interface SnapshotContextValue {
  /** Last good snapshot; never cleared when a poll fails. */
  snapshot: Snapshot | null;
  /** performance.now() at receipt of `snapshot`. */
  receivedAtMonotonic: number | null;
  /** performance.now(), refreshed periodically so tile ages keep growing while offline. */
  nowMono: number;
  /** True after two consecutive failed polls. */
  offline: boolean;
}

export const SnapshotContext = createContext<SnapshotContextValue | null>(null);
