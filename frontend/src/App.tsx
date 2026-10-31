import { ListsProvider } from './lists/ListsProvider';
import { Shell } from './shell/Shell';
import { SnapshotProvider } from './snapshot/SnapshotProvider';

export function App() {
  return (
    <SnapshotProvider>
      <ListsProvider>
        <Shell />
      </ListsProvider>
    </SnapshotProvider>
  );
}
