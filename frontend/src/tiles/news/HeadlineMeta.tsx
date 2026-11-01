import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatAge } from '../weather/format';
import { describeAge } from './format';
import type { Headline } from './headlines';

interface Props {
  headline: Headline;
  now: number;
  timeZone: string;
  /** Hide the Regional/Welt label visually on short screens (it stays for screen readers). */
  compactLabel?: boolean;
}

/** Group label, source name and age; a stale source says so in text with a clock icon. */
export function HeadlineMeta({ headline, now, timeZone, compactLabel = false }: Props) {
  const { t, i18n } = useTranslation();
  const age = describeAge(headline.publishedAt, now, i18n.language, timeZone);
  return (
    <>
      <span className={`font-medium text-ink ${compactLabel ? 'tablet-short:sr-only' : ''}`}>
        {t(headline.group === 'local' ? 'news.regional' : 'news.world')}
      </span>
      <span>{headline.sourceName}</span>
      {headline.stale && headline.sourceAgeSeconds !== null ? (
        <span className="flex items-center gap-1 text-warn">
          <Clock aria-hidden="true" className="h-[1em] w-[1em] shrink-0" />
          {t('news.stale', { age: formatAge(headline.sourceAgeSeconds, i18n.language) })}
        </span>
      ) : (
        <span>{age.kind === 'justNow' ? t('tile.justNow') : age.text}</span>
      )}
    </>
  );
}
