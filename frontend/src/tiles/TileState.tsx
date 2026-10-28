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
import type { StateTextKeys } from './types';

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

export function TileState({ kind, texts }: { kind: StateKind; texts?: StateTextKeys | undefined }) {
  const { t } = useTranslation();
  const view = stateViews[kind];
  const Icon = view.icon;
  return (
    <div className="flex h-full items-center justify-center gap-5 text-ink-muted">
      <Icon
        aria-hidden="true"
        data-state-icon={view.iconName}
        className="h-[1.3em] w-[1.3em] shrink-0"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p data-testid="state-title" className="text-title text-ink">
          {t(texts?.titleKey ?? view.titleKey)}
        </p>
        <p className="text-caption tablet-short:sr-only">{t(texts?.hintKey ?? view.hintKey)}</p>
      </div>
    </div>
  );
}
