import { useTranslation } from 'react-i18next';

export const viewIds = ['now', 'days', 'rain'] as const;
export type ViewId = (typeof viewIds)[number];

interface Props {
  index: number;
  onSelect(index: number): void;
}

/** Tabs for the three weather views: 56 px touch targets, the current one shown as a longer pill. */
export function ViewIndicators({ index, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <div role="tablist" aria-label={t('weather.viewSwitch')} className="flex items-center">
      {viewIds.map((id, position) => {
        const current = position === index;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={current}
            aria-label={t(`weather.views.${id}`)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(position);
            }}
            className="flex min-h-14 min-w-14 items-center justify-center"
          >
            <span
              data-testid="indicator-shape"
              className={`h-3 rounded-full bg-ink transition-all duration-calm ${current ? 'w-10' : 'w-3 opacity-40'}`}
            />
          </button>
        );
      })}
    </div>
  );
}
