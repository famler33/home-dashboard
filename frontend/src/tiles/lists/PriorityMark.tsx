import { ChevronUp, ChevronsUp, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Priority } from '../../api/lists-types';

const icons = { high: ChevronsUp, medium: ChevronUp, low: Minus } as const;
const tones: Record<Priority, string> = {
  high: 'text-danger',
  medium: 'text-warn',
  low: 'text-ink-muted',
};

/** Shape first, colour second: the level is readable without colour and has a text for screen readers. */
export function PriorityMark({ level }: { level: Priority }) {
  const { t } = useTranslation();
  const Icon = icons[level];
  return (
    <span
      data-testid="priority-mark"
      data-level={level}
      className={`inline-flex shrink-0 items-center ${tones[level]}`}
    >
      <Icon aria-hidden="true" className="h-[1.3em] w-[1.3em]" strokeWidth={3} />
      <span className="sr-only">{t(`lists.priority.${level}`)}</span>
    </span>
  );
}
