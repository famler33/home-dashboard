import type { CalendarTab } from './types';

import { dotClass } from './Legend';
import type { CalendarColor } from './types';

export interface TabItem {
  id: CalendarTab;
  label: string;
  /** Calendar colour shown as a dot in front of the name. */
  color?: CalendarColor;
}

interface Props {
  tabs: readonly TabItem[];
  active: CalendarTab;
  label: string;
  layout: 'tablet' | 'phone';
  onSelect(tab: CalendarTab): void;
}

/** Labelled segmented control: the active tab is a filled pill, the others an outline. */
export function Tabs({ tabs, active, label, layout, onSelect }: Props) {
  const wall = layout === 'tablet';
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-2 ${wall ? '' : 'sticky top-0 z-10 overflow-x-auto bg-surface-raised'}`}
    >
      {tabs.map((tab) => {
        const current = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={current}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(tab.id);
            }}
            className={`${wall ? 'min-h-14 px-5' : 'min-h-11 shrink-0 px-4'} max-w-[10em] truncate rounded-full text-caption transition-colors duration-calm ${
              current
                ? 'bg-ink font-semibold text-surface-raised'
                : 'text-ink-muted ring-1 ring-inset ring-ink-muted/40'
            }`}
          >
            {tab.color && (
              <span
                aria-hidden="true"
                data-testid="tab-dot"
                className={`mr-2 inline-block h-3 w-3 rounded-full align-middle ${dotClass[tab.color]}`}
              />
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
