import {
  CircleHelp,
  Info,
  OctagonAlert,
  Siren,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SourceSnapshot } from '../../api/types';
import { formatClock } from './format';
import { isAlertsPayload, type AlertSeverity } from './types';

const icons: Record<AlertSeverity, LucideIcon> = {
  minor: Info,
  moderate: TriangleAlert,
  severe: OctagonAlert,
  extreme: Siren,
};

interface Props {
  alerts: SourceSnapshot | undefined;
  /** True once the weather values themselves have loaded (an alerts source that never loaded is then overdue). */
  weatherLoaded: boolean;
  now: number;
  timeZone: string;
}

/** True when the alerts source is fresh and has an unexpired alert. */
export function hasActiveAlert(alerts: SourceSnapshot | undefined, now: number): boolean {
  if (!alerts || alerts.status !== 'fresh' || !isAlertsPayload(alerts.data)) return false;
  return alerts.data.alerts.some((alert) => Date.parse(alert.expires) > now);
}

export function AlertBanner({ alerts, weatherLoaded, now, timeZone }: Props) {
  const { t } = useTranslation();
  if (!alerts) return null;

  const unknown =
    alerts.status === 'stale' ||
    alerts.status === 'error' ||
    (alerts.status === 'never-loaded' && weatherLoaded);
  if (unknown) {
    return (
      <p className="flex items-center gap-2 text-caption text-ink-muted">
        <CircleHelp aria-hidden="true" className="h-[1.1em] w-[1.1em] shrink-0" />
        <span>{t('weather.alerts.unknown')}</span>
      </p>
    );
  }
  if (alerts.status !== 'fresh' || !isAlertsPayload(alerts.data)) return null;

  const active = alerts.data.alerts.filter((alert) => Date.parse(alert.expires) > now);
  const [first] = active;
  if (!first) return null;

  const Icon = icons[first.severity];
  const started = Date.parse(first.onset) <= now;
  const window = started
    ? t('weather.alerts.until', { time: formatClock(first.expires, timeZone) })
    : t('weather.alerts.from', { time: formatClock(first.onset, timeZone) });
  const severe = first.severity === 'severe' || first.severity === 'extreme';

  return (
    <div
      role="group"
      aria-label={t('weather.alerts.label')}
      className={`flex items-center gap-2 rounded-2xl border-l-8 bg-surface px-3 py-1 text-caption ${severe ? 'border-danger' : 'border-warn'}`}
    >
      <Icon
        aria-hidden="true"
        data-level={first.severity}
        className={`h-[1.3em] w-[1.3em] shrink-0 ${severe ? 'text-danger' : 'text-warn'}`}
      />
      <div className="min-w-0 leading-tight">
        <p data-testid="alert-line" className="font-medium">{`${first.type} · ${window}`}</p>
        <p data-testid="alert-line" className="text-ink-muted">
          {active.length > 1
            ? `${t(`weather.alerts.level.${first.severity}`)} · ${t('weather.alerts.more', { count: active.length - 1 })}`
            : t(`weather.alerts.level.${first.severity}`)}
        </p>
      </div>
    </div>
  );
}
