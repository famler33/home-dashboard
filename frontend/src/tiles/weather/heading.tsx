import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { isWeatherPayload } from './types';

/** "Wetter · <location>"; on short screens the location is dropped so the view indicators fit. */
export function weatherHeading(data: unknown, t: TFunction): ReactNode | null {
  if (!isWeatherPayload(data)) return null;
  return (
    <>
      {t('tiles.weather')}
      <span className="tablet-short:hidden">{` · ${data.location.name}`}</span>
    </>
  );
}
