import { useTranslation } from 'react-i18next';

export function Credits({ variant }: { variant: 'short' | 'full' | 'radar' }) {
  const { t } = useTranslation();
  const text =
    variant === 'short'
      ? t('weather.credit.short')
      : variant === 'full'
        ? t('weather.credit.full')
        : t('weather.credit.radar');
  return <p className="text-caption leading-tight text-ink-muted">{text}</p>;
}
