import { Clock } from 'lucide-react';
import { useId, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { relativeAge, type TileStatus } from '../snapshot/freshness';
import { TileState, type StateKind } from './TileState';
import type { StateTextKeys } from './types';

export type FrameStatus = TileStatus | 'crashed';

interface Props {
  title: ReactNode;
  status: FrameStatus;
  /** Age of the data in seconds, `null` when there is none or the tile has no source. */
  ageSeconds: number | null;
  index: number;
  stateTexts?: Partial<Record<'never-loaded' | 'error', StateTextKeys>> | undefined;
  /** Show the update footer for fresh data too (default); stale data always shows it. */
  freshFooter?: boolean;
  children?: ReactNode;
}

function useLastUpdated(ageSeconds: number | null): string | null {
  const { t, i18n } = useTranslation();
  if (ageSeconds === null) return null;
  const age = relativeAge(ageSeconds);
  const relative =
    age.kind === 'justNow'
      ? t('tile.justNow')
      : new Intl.RelativeTimeFormat(i18n.language, { numeric: 'always', style: 'short' }).format(
          age.value,
          age.unit,
        );
  return t('tile.lastUpdated', { relative });
}

export function TileFrame({
  title,
  status,
  ageSeconds,
  index,
  stateTexts,
  freshFooter = true,
  children,
}: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const lastUpdated = useLastUpdated(
    status === 'stale' || (status === 'fresh' && freshFooter) ? ageSeconds : null,
  );
  const showsContent = status === 'fresh' || status === 'stale';

  return (
    <section
      aria-labelledby={headingId}
      data-status={status}
      style={{ '--i': index } as CSSProperties}
      className="animate-tile-in relative flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-3xl bg-surface-raised p-5 shadow-sm tablet-short:gap-2 tablet-short:p-4"
    >
      <h2 id={headingId} className="self-start text-caption font-medium text-ink-muted">
        {title}
      </h2>
      <div className="min-h-0 flex-1 overflow-hidden">
        {showsContent ? (
          children
        ) : (
          <TileState
            kind={status as StateKind}
            texts={
              status === 'never-loaded' || status === 'error' ? stateTexts?.[status] : undefined
            }
          />
        )}
      </div>
      {lastUpdated !== null && (
        <footer
          data-testid="tile-footer"
          className={`flex items-center gap-2 text-caption ${status === 'stale' ? 'text-warn' : 'text-ink-muted'}`}
        >
          {status === 'stale' && (
            <>
              <Clock aria-hidden="true" className="h-[1em] w-[1em]" />
              <span className="font-medium">{t('tile.stale')}</span>
            </>
          )}
          <span>{lastUpdated}</span>
        </footer>
      )}
    </section>
  );
}
