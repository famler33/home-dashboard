import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { de } from '../../i18n/de';
import { i18n } from '../../i18n';
import type { SourceSnapshot } from '../../api/types';
import { sourceFixture } from '../../test-fixtures';
import { AlertBanner } from './AlertBanner';
import { weatherNow, weatherSource } from './test-data';
import type { AlertsPayload } from './types';

const now = weatherNow;
const alert = (
  over: Partial<AlertsPayload['alerts'][number]> = {},
): AlertsPayload['alerts'][number] => ({
  id: 'a',
  type: 'Gewitter',
  severity: 'severe',
  onset: '2026-10-28T16:00:00.000Z',
  expires: '2026-10-28T20:00:00.000Z',
  ...over,
});
const entry = (
  alerts: AlertsPayload['alerts'],
  status: SourceSnapshot['status'] = 'fresh',
): SourceSnapshot =>
  sourceFixture({ id: 'weather-alerts', status, data: { alerts }, staleAfterSeconds: 1800 });

function show(alerts: SourceSnapshot | undefined, weatherLoaded = true) {
  return render(
    <I18nextProvider i18n={i18n}>
      <AlertBanner
        alerts={alerts}
        weatherLoaded={weatherLoaded}
        now={now}
        timeZone="Europe/Berlin"
      />
    </I18nextProvider>,
  );
}

// Covers: FR-11, AC-31, AC-32, AC-33, AC-34, AC-35
describe('AlertBanner', () => {
  it('shows icon, German type, severity as text and the validity period', () => {
    const { container } = show(entry([alert()]));
    const banner = screen.getByRole('group', { name: de.weather.alerts.label });
    expect(banner).toHaveTextContent('Gewitter');
    expect(banner).toHaveTextContent(de.weather.alerts.level.severe);
    expect(banner).toHaveTextContent('ab 17:00 Uhr');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('shows the end time for a warning that is already active', () => {
    show(entry([alert({ onset: '2026-10-28T12:00:00.000Z' })]));
    expect(screen.getByRole('group')).toHaveTextContent('bis 21:00 Uhr');
  });

  it('writes the severity as text and uses a distinct icon per level', () => {
    const icons = new Set<string>();
    for (const severity of ['minor', 'moderate', 'severe', 'extreme'] as const) {
      const { container, unmount } = show(entry([alert({ severity })]));
      expect(screen.getByRole('group')).toHaveTextContent(de.weather.alerts.level[severity]);
      icons.add(container.querySelector('svg')!.getAttribute('data-level') ?? '');
      unmount();
    }
    expect(icons.size).toBe(4);
  });

  it('shows the most severe warning and the number of further ones', () => {
    show(
      entry([
        alert({ severity: 'severe' }),
        alert({ id: 'b', type: 'Windböen', severity: 'moderate' }),
        alert({ id: 'c', type: 'Frost', severity: 'minor' }),
      ]),
    );
    const banner = screen.getByRole('group');
    expect(banner).toHaveTextContent('Gewitter');
    expect(banner).toHaveTextContent('+2 weitere');
    expect(banner).not.toHaveTextContent('Windböen');
  });

  it('ignores warnings that have expired in the meantime', () => {
    show(entry([alert({ expires: '2026-10-28T13:00:00.000Z' })]));
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('renders nothing for no alerts', () => {
    const { container } = show(entry([]));
    expect(container).toBeEmptyDOMElement();
  });

  it.each(['stale', 'error'] as const)(
    'shows Warnungen nicht prüfbar for a %s alerts source',
    (status) => {
      show(entry([], status));
      expect(screen.getByText(de.weather.alerts.unknown)).toBeInTheDocument();
      expect(screen.queryByText(/kein/i)).toBeNull();
    },
  );

  it('shows Warnungen nicht prüfbar for a never-loaded source once the weather itself has loaded', () => {
    show(
      sourceFixture({
        id: 'weather-alerts',
        status: 'never-loaded',
        data: null,
        ageSeconds: null,
        lastUpdated: null,
      }),
      true,
    );
    expect(screen.getByText(de.weather.alerts.unknown)).toBeInTheDocument();
  });

  it('stays quiet for a never-loaded alerts source before anything has loaded', () => {
    const { container } = show(
      sourceFixture({
        id: 'weather-alerts',
        status: 'never-loaded',
        data: null,
        ageSeconds: null,
        lastUpdated: null,
      }),
      false,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the alerts entry is missing and the weather has not loaded', () => {
    const { container } = show(undefined, false);
    expect(container).toBeEmptyDOMElement();
  });

  it('works with the golden alerts entry', () => {
    show({ ...weatherSource('weather-alerts') });
    expect(screen.getByRole('group')).toBeInTheDocument();
  });
});
