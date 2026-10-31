import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TileDefinition } from '../tiles/types';
import { DetailBusyContext } from './detail-context';

interface Props {
  definition: TileDefinition;
  onClose(): void;
  /** Without input for this long the view closes by itself (milliseconds). */
  idleMs?: number;
}

const IDLE_MS = 120_000;

/**
 * Full-screen detail view of a tile. It lives inside the shell (so the burn-in drift applies),
 * is a modal dialog, closes with the back control, Escape or after two quiet minutes, and never
 * closes by itself while the detail component reports a draft.
 */
export function DetailOverlay({ definition, onClose, idleMs = IDLE_MS }: Props) {
  const { t } = useTranslation();
  const backRef = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [input, setInput] = useState(0);
  const Detail = definition.detail;

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (busy.current) setInput((count) => count + 1);
      else onClose();
    }, idleMs);
    return () => clearTimeout(timer);
  }, [input, idleMs, onClose]);

  const busyValue = useMemo(
    () => ({
      setBusy(on: boolean) {
        busy.current = on;
      },
    }),
    [],
  );
  const touch = () => setInput((count) => count + 1);
  if (!Detail) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(definition.detailLabelKey ?? definition.titleKey)}
      onPointerDownCapture={touch}
      onKeyDownCapture={touch}
      onScrollCapture={touch}
      className="view-enter absolute inset-0 z-40 flex flex-col gap-4 bg-surface p-8 tablet-short:gap-2 tablet-short:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-title text-ink">{t(definition.titleKey)}</h2>
        <button
          ref={backRef}
          type="button"
          onClick={onClose}
          className="flex min-h-14 min-w-14 items-center gap-2 rounded-full bg-surface-raised px-6 text-body text-ink shadow-sm"
        >
          <ArrowLeft aria-hidden="true" className="h-[1.2em] w-[1.2em]" />
          {t('detail.back')}
        </button>
      </div>
      <DetailBusyContext.Provider value={busyValue}>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Detail onClose={onClose} />
        </div>
      </DetailBusyContext.Provider>
    </div>
  );
}
