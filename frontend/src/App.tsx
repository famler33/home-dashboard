import { LIST_PAGE_PATH } from './lists/paths';
import { ListsProvider } from './lists/ListsProvider';
import { ListPage } from './pages/ListPage';
import { Shell } from './shell/Shell';
import { SnapshotProvider } from './snapshot/SnapshotProvider';

const isListPage = (): boolean => window.location.pathname.replace(/\/+$/, '') === LIST_PAGE_PATH;

export function App() {
  return (
    <SnapshotProvider>
      <ListsProvider>{isListPage() ? <ListPage /> : <Shell />}</ListsProvider>
    </SnapshotProvider>
  );
}
