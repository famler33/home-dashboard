import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Calm offline indicator, readable from a distance: icon, label and a color distinct from the stale accent. */
export function StatusDot({ offline }: { offline: boolean }) {
  const { t } = useTranslation();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-full bg-surface-raised px-5 py-2 text-caption text-danger shadow-sm"
    >
      <WifiOff aria-hidden="true" className="h-[1.2em] w-[1.2em]" />
      <span>{t('status.offline')}</span>
    </div>
  );
}
