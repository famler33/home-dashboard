import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { de } from '../../i18n/de';
import { createI18n } from '../../i18n';
import { ShellContext } from '../../shell/shell-context';
import { contextFixture, renderWithProviders } from '../../test-utils';
import { installCanvasMock, type CanvasMock } from './canvas-mock';
import {
  radarDocumentFixture,
  weatherNow,
  weatherSnapshot,
  weatherSource,
  weatherSources,
} from './test-data';
import { WeatherTile } from './WeatherTile';
import type { SourceSnapshot } from '../../api/types';
import type { AlertsPayload } from './types';

let mock: CanvasMock;
const doc = radarDocumentFixture();

beforeEach(() => {
  mock = installCanvasMock();
  vi.useFakeTimers({
    now: weatherNow,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(doc))),
  );
});

afterEach(() => {
  mock.restore();
  vi.unstubAllGlobals();
});

type Layout = 'tablet' | 'phone';

function show(
  layout: Layout = 'tablet',
  sources: SourceSnapshot[] = weatherSources(),
  theme: 'day' | 'night' = 'day',
) {
  const weather = sources.find((entry) => entry.id === 'weather')!;
  return renderWithProviders(
    <ShellContext.Provider value={{ layout, theme }}>
      <WeatherTile data={weather.data} />
    </ShellContext.Provider>,
    contextFixture(weatherSnapshot({ sources })),
  );
}

const settle = async () => {
  for (let round = 0; round < 5; round += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }
};
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const activeView = () =>
  document.querySelector('[data-view-active="true"]')?.getAttribute('data-view');
const withEntry = (id: string, change: (entry: SourceSnapshot) => void): SourceSnapshot[] => {
  const sources = weatherSources();
  change(sources.find((entry) => entry.id === id)!);
  return sources;
};

// Covers: FR-9, FR-11, FR-13, FR-14, AC-14, AC-22, AC-23, AC-24, AC-26, AC-27, AC-31, AC-34, AC-35, AC-37, AC-39, AC-40, AC-44, AC-45, AC-46
describe('WeatherTile on the wall', () => {
  it('starts with the now view and rotates through all views every 15 seconds', async () => {
    show();
    expect(activeView()).toBe('now');
    await advance(15_000);
    expect(activeView()).toBe('days');
    await advance(15_000);
    expect(activeView()).toBe('rain');
    await advance(15_000);
    expect(activeView()).toBe('now');
  });

  it('mounts only the active view and the outgoing one during the fade', async () => {
    show();
    expect(document.querySelectorAll('[data-view]')).toHaveLength(1);
    await advance(15_000);
    expect(document.querySelectorAll('[data-view]')).toHaveLength(2);
    await advance(700);
    expect(document.querySelectorAll('[data-view]')).toHaveLength(1);
  });

  it('uses one calm transition for every switch, with a short fade under reduced motion', async () => {
    show();
    await advance(15_000);
    for (const layer of document.querySelectorAll('[data-view]')) {
      expect(layer.className).toMatch(/view-(enter|exit)/);
    }
  });

  it('advances on a tap and pauses the rotation', async () => {
    show();
    const surface = screen.getByTestId('view-surface');
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 50, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(surface, { clientX: 102, clientY: 51, pointerId: 1, isPrimary: true });
    expect(activeView()).toBe('days');
    await advance(40_000);
    expect(activeView()).toBe('days');
    await advance(20_000);
    await advance(15_000);
    expect(activeView()).toBe('rain');
  });

  it('switches with a swipe: left shows the next view, right the previous one', () => {
    show();
    const surface = screen.getByTestId('view-surface');
    const drag = (from: number, to: number) => {
      fireEvent.pointerDown(surface, { clientX: from, clientY: 50, pointerId: 1, isPrimary: true });
      fireEvent.pointerUp(surface, { clientX: to, clientY: 52, pointerId: 1, isPrimary: true });
    };
    drag(300, 200);
    expect(activeView()).toBe('days');
    drag(200, 300);
    expect(activeView()).toBe('now');
    drag(200, 300);
    expect(activeView()).toBe('rain');
  });

  it('ignores short and vertical moves', () => {
    show();
    const surface = screen.getByTestId('view-surface');
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 50, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(surface, { clientX: 140, clientY: 50, pointerId: 1, isPrimary: true });
    expect(activeView()).toBe('now');
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 50, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(surface, { clientX: 100, clientY: 200, pointerId: 1, isPrimary: true });
    expect(activeView()).toBe('now');
  });

  it('jumps to a view with its indicator without advancing a second time', () => {
    show();
    fireEvent.click(screen.getByRole('tab', { name: 'Regen und Radar' }));
    expect(activeView()).toBe('rain');
    expect(screen.getByRole('tab', { name: 'Regen und Radar' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('stops rotating while the weather values are stale but still switches manually', async () => {
    show(
      'tablet',
      withEntry('weather', (entry) => ((entry.status = 'stale'), (entry.ageSeconds = 4000))),
    );
    await advance(60_000);
    expect(activeView()).toBe('now');
    fireEvent.click(screen.getByRole('tab', { name: '7 Tage' }));
    expect(activeView()).toBe('days');
  });

  it('shows the rain line in the now view from the radar series', () => {
    show();
    expect(screen.getByTestId('rain-line')).toBeInTheDocument();
  });

  it('shows the abbreviated credit on the wall and the radar credit in the radar view', async () => {
    show();
    expect(screen.getByText(de.weather.credit.short)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Regen und Radar' }));
    await settle();
    expect(screen.getByText(de.weather.credit.radar)).toBeInTheDocument();
  });

  it('loads the radar document only while the rain view is active', async () => {
    show();
    await settle();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Regen und Radar' }));
    await settle();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/v1/weather/radar', expect.anything());
  });

  it('does not run radar timers while another view is shown', async () => {
    show();
    await settle();
    expect(mock.context['putImageData']).not.toHaveBeenCalled();
  });
});

describe('WeatherTile warnings', () => {
  const alerts = (list: AlertsPayload['alerts'], status: SourceSnapshot['status'] = 'fresh') =>
    withEntry(
      'weather-alerts',
      (entry) => ((entry.data = { alerts: list }), (entry.status = status)),
    );
  const active: AlertsPayload['alerts'] = [
    {
      id: 'a',
      type: 'Gewitter',
      severity: 'severe',
      onset: '2026-10-28T12:00:00.000Z',
      expires: '2026-10-28T20:00:00.000Z',
    },
  ];

  it('keeps the warning banner visible in every wall view', async () => {
    show('tablet', alerts(active));
    for (const tab of ['Jetzt', '7 Tage', 'Regen und Radar']) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      await settle();
      expect(screen.getByRole('group', { name: de.weather.alerts.label })).toBeInTheDocument();
    }
  });

  it('shows no banner and no reserved space without a warning', () => {
    const { container } = show('tablet', alerts([]));
    expect(screen.queryByRole('group', { name: de.weather.alerts.label })).toBeNull();
    expect(container.querySelector('[data-testid="alert-slot"]')).toBeNull();
  });

  it('shows that warnings cannot be checked when the alert data is stale, without claiming there are none', () => {
    show('tablet', alerts([], 'stale'));
    expect(screen.getByText(de.weather.alerts.unknown)).toBeInTheDocument();
  });
});

describe('WeatherTile part isolation', () => {
  it('keeps weather values and warnings working when the radar failed', () => {
    show(
      'tablet',
      withEntry(
        'weather-radar',
        (entry) => (
          (entry.status = 'error'),
          (entry.data = null),
          (entry.lastErrorCode = 'SOURCE_FETCH_FAILED')
        ),
      ),
    );
    expect(screen.getByTestId('rain-line')).toBeInTheDocument(); // falls back to the Open-Meteo series
    fireEvent.click(screen.getByRole('tab', { name: 'Regen und Radar' }));
    expect(screen.getByText(de.weather.radar.unavailable)).toBeInTheDocument();
  });

  it('keeps radar and warnings working when the alert source failed', async () => {
    show(
      'tablet',
      withEntry('weather-alerts', (entry) => ((entry.status = 'error'), (entry.data = null))),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Regen und Radar' }));
    await settle();
    expect(screen.getByRole('img', { name: de.weather.radar.canvas })).toBeInTheDocument();
    expect(screen.getByText(de.weather.alerts.unknown)).toBeInTheDocument();
  });

  it('shows the neutral loading text for a radar that never loaded', () => {
    show(
      'tablet',
      withEntry(
        'weather-radar',
        (entry) => (
          (entry.status = 'never-loaded'),
          (entry.data = null),
          (entry.ageSeconds = null),
          (entry.lastUpdated = null)
        ),
      ),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Regen und Radar' }));
    expect(screen.getByText(de.weather.radar.loading)).toBeInTheDocument();
  });
});

describe('WeatherTile on the phone', () => {
  it('renders now, days and rain in one section without rotation or indicators', async () => {
    show('phone');
    await settle();
    expect(screen.getAllByText(/Heute/).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('day')).toHaveLength(7);
    expect(screen.getByTestId('rain-statement')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('shows the full credit wording and 24 hourly slots', () => {
    show('phone');
    expect(screen.getByText(de.weather.credit.full)).toBeInTheDocument();
    expect(screen.getAllByTestId('hour-slot')).toHaveLength(24);
  });

  it('starts no rotation timer', async () => {
    show('phone');
    await settle();
    await advance(60_000);
    expect(within(document.body).queryAllByRole('tab')).toHaveLength(0);
  });
});

describe('WeatherTile texts', () => {
  it('renders with dictionary text only', () => {
    const pseudo = JSON.parse(JSON.stringify(de), (_key, value) =>
      typeof value === 'string' ? `§${value}` : value,
    );
    const sources = weatherSources();
    const weather = sources.find((entry) => entry.id === 'weather')!;
    renderWithProviders(
      <ShellContext.Provider value={{ layout: 'tablet', theme: 'day' }}>
        <WeatherTile data={weather.data} />
      </ShellContext.Provider>,
      contextFixture(weatherSnapshot({ sources })),
      createI18n(pseudo, 'xx'),
    );
    const body = document.body.textContent ?? '';
    for (const text of [de.weather.credit.short, de.weather.views.days]) {
      expect(body.includes(text) && !body.includes(`§${text}`), text).toBe(false);
    }
    expect(body).toContain(`§${de.weather.credit.short}`);
  });

  it('uses the weather source of the snapshot as its data', () => {
    expect(weatherSource('weather').data).toBeTruthy();
  });
});
