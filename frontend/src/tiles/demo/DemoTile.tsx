import { useTranslation } from 'react-i18next';
import type { TileContentProps } from '../types';

function readValue(data: unknown): number | null {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    const value = (data as { value: unknown }).value;
    return typeof value === 'number' ? value : null;
  }
  return null;
}

export function DemoTile({ data }: TileContentProps) {
  const { t } = useTranslation();
  const value = readValue(data);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <p className="text-caption text-ink-muted">{t('demo.value')}</p>
      <p className="text-display tabular-nums">{value ?? ''}</p>
    </div>
  );
}
