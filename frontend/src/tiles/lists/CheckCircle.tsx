import { Check } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

const MIN_PRESS_MS = 80;
const MAX_MOVE_PX = 10;

interface Props {
  checked: boolean;
  label: string;
  /** Wall tablet: 56 px target and tap filtering; phone: 44 px. */
  wall: boolean;
  onToggle(): void;
}

/**
 * The only control that checks an entry on the wall. Very short taps and taps that moved
 * (scrolling, palms) are ignored; keyboard activation works as usual.
 */
export function CheckCircle({ checked, label, wall, onToggle }: Props) {
  const { t } = useTranslation();
  const press = useRef<{ at: number; x: number; y: number } | null>(null);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`${t('lists.check')}: ${label}`}
      onPointerDown={(event) => {
        press.current = { at: Date.now(), x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = press.current;
        press.current = null;
        if (!start) return;
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (Date.now() - start.at >= MIN_PRESS_MS && moved <= MAX_MOVE_PX) onToggle();
      }}
      onClick={(event) => {
        // a click without pointer details comes from the keyboard (or assistive technology)
        if (event.detail === 0) onToggle();
      }}
      className={`${wall ? 'min-h-14 min-w-14' : 'min-h-11 min-w-11'} flex shrink-0 items-center justify-center`}
    >
      <span
        className={`flex h-[1em] w-[1em] items-center justify-center rounded-full ring-2 ring-inset transition-colors duration-calm ${
          checked ? 'bg-ink text-surface-raised ring-ink' : 'ring-ink-muted'
        }`}
      >
        {checked && (
          <Check
            data-testid="check-icon"
            aria-hidden="true"
            className="h-[0.7em] w-[0.7em]"
            strokeWidth={3}
          />
        )}
      </span>
    </button>
  );
}
