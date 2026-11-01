import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useShell } from '../../shell/shell-context';
import { effectiveAgeSeconds } from '../../snapshot/freshness';
import { useSnapshot } from '../../snapshot/useSnapshot';
import { classifyGesture } from '../shared/gestures';
import { useViewRotation } from '../shared/useViewRotation';
import { buildHeadlines, type Headline } from './headlines';
import { HeadlineMeta } from './HeadlineMeta';
import { PhoneList } from './PhoneList';

const DWELL_MS = 15_000;
const RESUME_MS = 60_000;
const FADE_MS = 600;

const buttonClass =
  'flex min-h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

export function NewsTile() {
  const { t } = useTranslation();
  const { snapshot, receivedAtMonotonic, nowMono } = useSnapshot();
  const { layout } = useShell();
  const timeZone = snapshot?.settings.timezone ?? 'UTC';
  // Server time plus the monotonic time since receipt: independent of the tablet's clock.
  const now =
    snapshot && receivedAtMonotonic !== null
      ? Date.parse(snapshot.serverTime) + Math.max(0, nowMono - receivedAtMonotonic)
      : 0;
  const headlines = buildHeadlines(
    (snapshot?.sources ?? [])
      .filter((source) => source.id.startsWith('news-'))
      .map((entry) => ({
        entry,
        ageSeconds:
          receivedAtMonotonic !== null
            ? effectiveAgeSeconds(entry, receivedAtMonotonic, nowMono)
            : entry.ageSeconds,
      })),
  );

  if (headlines.length === 0) {
    return <p className="text-body text-ink-muted">{t('news.empty')}</p>;
  }
  if (layout === 'phone') return <PhoneList headlines={headlines} now={now} timeZone={timeZone} />;
  return <WallRotation headlines={headlines} now={now} timeZone={timeZone} />;
}

function WallRotation({
  headlines,
  now,
  timeZone,
}: {
  headlines: readonly Headline[];
  now: number;
  timeZone: string;
}) {
  const { t } = useTranslation();
  const total = headlines.length;
  const allStale = headlines.every((headline) => headline.stale);
  const rotation = useViewRotation({
    viewCount: total,
    dwellMs: DWELL_MS,
    resumeMs: RESUME_MS,
    autoplay: total > 1 && !allStale,
  });
  const index = Math.min(rotation.index, total - 1);

  // Keep the outgoing headline mounted for the length of the fade.
  const [stage, setStage] = useState<{ current: number; previous: number | null }>({
    current: index,
    previous: null,
  });
  if (stage.current !== index) setStage({ current: index, previous: stage.current });
  useEffect(() => {
    if (stage.previous === null) return undefined;
    const timer = setTimeout(() => setStage((s) => ({ ...s, previous: null })), FADE_MS);
    return () => clearTimeout(timer);
  }, [stage.previous]);

  const pressed = useRef<{ x: number; y: number } | null>(null);
  const onDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.isPrimary === false) return;
    pressed.current = { x: event.clientX, y: event.clientY };
  };
  const onUp = (event: PointerEvent<HTMLDivElement>): void => {
    const start = pressed.current;
    pressed.current = null;
    if (!start) return;
    const gesture = classifyGesture({ dx: event.clientX - start.x, dy: event.clientY - start.y });
    if (gesture === 'tap' || gesture === 'swipe-left') rotation.next();
    else if (gesture === 'swipe-right') rotation.prev();
  };

  const layers = [stage.previous, stage.current].filter(
    (value): value is number => value !== null && headlines[value] !== undefined,
  );

  return (
    <div className="flex h-full min-h-0 items-center gap-1">
      <button
        type="button"
        aria-label={t('news.previous')}
        onClick={rotation.prev}
        className={`${buttonClass} -my-2`}
      >
        <ChevronLeft aria-hidden="true" className="h-[1.4em] w-[1.4em]" />
      </button>
      <div
        data-testid="view-surface"
        className="relative h-full min-h-0 flex-1 touch-pan-y select-none"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => (pressed.current = null)}
      >
        {layers.map((position) => {
          const headline = headlines[position]!;
          const isActive = position === stage.current;
          return (
            <div
              key={headline.id}
              data-headline-active={isActive}
              aria-hidden={!isActive}
              className={`absolute inset-0 flex flex-col justify-center gap-1 ${isActive ? 'view-enter' : 'view-exit'}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 text-caption text-ink-muted">
                <HeadlineMeta headline={headline} now={now} timeZone={timeZone} compactLabel />
                <span className="ml-auto tabular-nums">
                  {t('news.position', { index: position + 1, total })}
                </span>
              </div>
              <p
                data-testid="headline-title"
                className="line-clamp-2 text-body font-medium text-ink tablet-short:line-clamp-1"
              >
                {headline.title}
              </p>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        aria-label={t('news.next')}
        onClick={rotation.next}
        className={`${buttonClass} -my-2`}
      >
        <ChevronRight aria-hidden="true" className="h-[1.4em] w-[1.4em]" />
      </button>
    </div>
  );
}
