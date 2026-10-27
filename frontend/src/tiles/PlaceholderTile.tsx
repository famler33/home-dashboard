import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PlaceholderTile() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink-muted">
      <Hourglass aria-hidden="true" className="h-[2em] w-[2em]" />
      <p className="text-title text-ink">{t('placeholder.title')}</p>
      <p className="text-caption">{t('placeholder.hint')}</p>
    </div>
  );
}
