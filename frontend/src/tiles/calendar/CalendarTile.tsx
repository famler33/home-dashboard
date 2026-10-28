import { useTranslation } from 'react-i18next';
import { useShell } from '../../shell/shell-context';
import { useSnapshot } from '../../snapshot/useSnapshot';
import { CalendarView } from './CalendarView';
import { Tabs, type TabItem } from './Tabs';
import type { CalendarTab } from './types';
import { isCalendarSettings } from './types';
import { useIdleTab } from './useIdleTab';

const IDLE_MS = 60_000;

export function CalendarTile() {
  const { t } = useTranslation();
  const { snapshot, receivedAtMonotonic, nowMono } = useSnapshot();
  const { layout } = useShell();
  const wall = layout === 'tablet';
  const { tab, select, touch } = useIdleTab({ idleReset: wall, idleMs: IDLE_MS });

  const settings = snapshot?.settings.calendar;
  if (!snapshot || !settings || !isCalendarSettings(settings)) return null;

  // Server time plus the monotonic time since receipt: independent of the tablet's clock.
  const now =
    receivedAtMonotonic !== null
      ? Date.parse(snapshot.serverTime) + Math.max(0, nowMono - receivedAtMonotonic)
      : Date.parse(snapshot.serverTime);
  const tabs: TabItem[] =
    settings.calendars.length > 1
      ? [
          { id: 'all', label: t('calendar.tabs.all') },
          ...settings.calendars.map((info) => ({
            id: info.id as CalendarTab,
            label: info.name,
            color: info.color,
          })),
        ]
      : [];
  const active: CalendarTab = tabs.some((item) => item.id === tab) ? tab : 'all';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" onPointerDown={touch} onKeyDown={touch}>
      {tabs.length > 0 && (
        <Tabs
          tabs={tabs}
          active={active}
          label={t('calendar.tabs.label')}
          layout={layout}
          onSelect={select}
        />
      )}
      <CalendarView snapshot={snapshot} now={now} layout={layout} tab={active} />
    </div>
  );
}
