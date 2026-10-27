import {
  CircleDashed,
  Inbox,
  Loader,
  TriangleAlert,
  CloudOff,
  type LucideIcon,
} from 'lucide-react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';

export type StateKind = 'loading' | 'never-loaded' | 'empty' | 'error' | 'crashed';

interface StateView {
  icon: LucideIcon;
  iconName: string;
  titleKey: ParseKeys;
  hintKey: ParseKeys;
}

export const stateViews: Record<StateKind, StateView> = {
  loading: {
    icon: Loader,
    iconName: 'loader',
    titleKey: 'states.loading.title',
    hintKey: 'states.loading.hint',
  },
  'never-loaded': {
    icon: CircleDashed,
    iconName: 'circle-dashed',
    titleKey: 'states.neverLoaded.title',
    hintKey: 'states.neverLoaded.hint',
  },
  empty: {
    icon: Inbox,
    iconName: 'inbox',
    titleKey: 'states.empty.title',
    hintKey: 'states.empty.hint',
  },
  error: {
    icon: CloudOff,
    iconName: 'cloud-off',
    titleKey: 'states.error.title',
    hintKey: 'states.error.hint',
  },
  crashed: {
    icon: TriangleAlert,
    iconName: 'triangle-alert',
    titleKey: 'states.crashed.title',
    hintKey: 'states.crashed.hint',
  },
};

export function TileState({ kind }: { kind: StateKind }) {
  const { t } = useTranslation();
  const view = stateViews[kind];
  const Icon = view.icon;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-ink-muted">
      <Icon aria-hidden="true" data-state-icon={view.iconName} className="h-[2em] w-[2em]" />
      <p data-testid="state-title" className="text-title text-ink">
        {t(view.titleKey)}
      </p>
      <p className="text-caption">{t(view.hintKey)}</p>
    </div>
  );
}
