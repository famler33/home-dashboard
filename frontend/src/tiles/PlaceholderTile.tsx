import { Hourglass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PlaceholderTile() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center gap-5 text-ink-muted">
      <Hourglass aria-hidden="true" className="h-[1.3em] w-[1.3em] shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="whitespace-nowrap text-title text-ink">{t('placeholder.title')}</p>
        <p className="text-caption tablet-short:sr-only">{t('placeholder.hint')}</p>
      </div>
    </div>
  );
}
