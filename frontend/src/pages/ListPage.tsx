import { useTranslation } from 'react-i18next';
import { ListsEditor } from '../lists/ListsEditor';
import { StatusDot } from '../shell/StatusDot';
import { useSnapshot } from '../snapshot/useSnapshot';

/**
 * The phone list page (`/listen`): only the editor. No burn-in drift, day/night schedule or
 * kiosk handling; the snapshot provider still reloads the page after an update and reports a lost connection.
 */
export function ListPage() {
  const { t } = useTranslation();
  const { offline } = useSnapshot();
  return (
    <div className="flex h-dvh flex-col gap-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-title text-ink">{t('tiles.lists')}</h1>
        <StatusDot offline={offline} />
      </header>
      <main className="min-h-0 flex-1">
        <ListsEditor layout="phone" />
      </main>
    </div>
  );
}
