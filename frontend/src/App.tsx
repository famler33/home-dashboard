import { Shell } from './shell/Shell';
import { SnapshotProvider } from './snapshot/SnapshotProvider';

export function App() {
  return (
    <SnapshotProvider>
      <Shell />
    </SnapshotProvider>
  );
}
