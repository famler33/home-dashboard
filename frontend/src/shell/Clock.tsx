import { LazyMotion, domAnimation } from 'motion/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RollingDigit } from './RollingDigit';

interface Props {
  timeZone?: string | undefined;
  /** Smaller variant for the phone header. */
  compact?: boolean;
}

export function Clock({ timeZone, compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));

  useEffect(() => {
    const timer = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 1_000);
    return () => clearInterval(timer);
  }, []);

  const instant = new Date(minute * 60_000);
  const locale = i18n.language === 'de' ? 'de-DE' : undefined;
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).format(instant);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(instant);
  const dateShort = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  }).format(instant);

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex flex-col gap-1 tablet-short:flex-row tablet-short:items-end tablet-short:gap-4">
        <time
          dateTime={instant.toISOString()}
          aria-label={t('clock.ariaLabel', { time })}
          className={`font-light leading-none tabular-nums ${compact ? 'text-display' : 'text-clock'}`}
        >
          {[...time].map((char, index) =>
            /\d/.test(char) ? (
              <RollingDigit key={index} value={char} />
            ) : (
              <span key={index} aria-hidden="true" className="mx-[0.04em]">
                {char}
              </span>
            ),
          )}
        </time>
        <p className="text-title text-ink-muted">
          <span className="tablet-short:hidden">{date}</span>
          <span aria-hidden="true" className="hidden tablet-short:inline">
            {dateShort}
          </span>
        </p>
      </div>
    </LazyMotion>
  );
}
