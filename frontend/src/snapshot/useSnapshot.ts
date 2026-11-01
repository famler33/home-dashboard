import { useContext } from 'react';
import { SnapshotContext, type SnapshotContextValue } from './snapshot-context';

export function useSnapshot(): SnapshotContextValue {
  const value = useContext(SnapshotContext);
  if (!value) throw new Error('useSnapshot must be used inside SnapshotProvider');
  return value;
}
