import { act, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../../i18n';
import { de } from '../../i18n/de';
import type { SourceSnapshot } from '../../api/types';
import { installCanvasMock, type CanvasMock } from './canvas-mock';
import { RainView } from './RainView';
import { radarDocumentFixture, weatherNow, weatherSource } from './test-data';
import type { WeatherPayload } from './types';

let mock: CanvasMock;
const doc = radarDocumentFixture();

beforeEach(() => {
  mock = installCanvasMock();
  vi.useFakeTimers({ now: weatherNow, toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  mock.restore();
});

const at = (offsetMin: number) => new Date(weatherNow + offsetMin * 60_000).toISOString();

function radarWith(series: number[], status: SourceSnapshot['status'] = 'fresh'): SourceSnapshot {
  const base = weatherSource('weather-radar');
  return {
    ...base,
    status,
    data: {
      version: doc.version,
      frames: [],
      homeSeries: series.map((mmPerHour, index) => ({ time: at(-60 + index * 5), mmPerHour })),
    },
  };
}

// radar steps: -60 .. +120 min in 5 minute steps = 37 entries; wet from +20 to +45 min
const wetFrom20To45 = Array.from({ length: 37 }, (_, index) => {
  const minute = -60 + index * 5;
  return minute >= 20 && minute < 45 ? 1.2 : 0;
});

function weatherWith(rain: number[], status: SourceSnapshot['status'] = 'fresh'): SourceSnapshot {
  const base = weatherSource('weather');
  const data = {
    ...(base.data as WeatherPayload),
    rainSeries: rain.map((mmPerHour, index) => ({ time: at(index * 15), mmPerHour })),
  };
  return { ...base, status, data };
}

function show(
  radar: SourceSnapshot | undefined,
  weather: SourceSnapshot | undefined,
  layout: 'wall' | 'phone' = 'wall',
) {
  return render(
    <I18nextProvider i18n={i18n}>
      <RainView
        weather={weather}
        radar={radar}
        radarAgeSeconds={20}
        layout={layout}
        active
        night={false}
        now={weatherNow}
        timeZone="Europe/Berlin"
        fetchImpl={vi.fn(async () => new Response(JSON.stringify(doc))) as unknown as typeof fetch}
      />
    </I18nextProvider>,
  );
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

// Covers: FR-6, AC-12, AC-13, AC-19
describe('RainView', () => {
  it('describes the next rain from the radar series and draws bars for at least two hours', async () => {
    show(radarWith(wetFrom20To45), weatherWith(new Array(16).fill(0)));
    await flush();
    expect(screen.getByTestId('rain-statement')).toHaveTextContent('Regen ab 15:10, ca. 25 Min.');
    const bars = screen.getByTestId('rain-bars');
    expect(bars).toHaveAttribute('data-source', 'radar');
    expect(Number(bars.getAttribute('data-bar-count'))).toBeGreaterThanOrEqual(8);
  });

  it('uses the Open-Meteo series when the radar is stale', async () => {
    const rain = [0, 0, 1, 1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    show(radarWith(wetFrom20To45, 'stale'), weatherWith(rain));
    await flush();
    expect(screen.getByTestId('rain-bars')).toHaveAttribute('data-source', 'open-meteo');
    expect(screen.getByTestId('rain-statement')).toHaveTextContent('Regen ab 15:20, ca. 45 Min.');
  });

  it('says that no rain is expected', async () => {
    show(radarWith(new Array(37).fill(0)), weatherWith(new Array(16).fill(0)));
    await flush();
    expect(screen.getByTestId('rain-statement')).toHaveTextContent(de.weather.rain.none);
  });

  it('shows the unavailable rain text when no series is usable and still renders the radar section', async () => {
    show(undefined, undefined);
    await flush();
    expect(screen.getByTestId('rain-statement')).toHaveTextContent(de.weather.rain.unavailable);
    expect(screen.getByText(de.weather.radar.loading)).toBeInTheDocument();
  });

  it('keeps the rain bars when the radar failed', async () => {
    const failed = { ...radarWith([]), status: 'error' as const, data: null };
    show(failed, weatherWith(new Array(16).fill(0.4)));
    await flush();
    expect(screen.getByTestId('rain-bars')).toHaveAttribute('data-source', 'open-meteo');
    expect(screen.getByText(de.weather.radar.unavailable)).toBeInTheDocument();
  });

  it('gives the bars an accessible description with the statement', async () => {
    show(radarWith(wetFrom20To45), weatherWith(new Array(16).fill(0)));
    await flush();
    expect(
      screen.getByRole('img', { name: new RegExp(de.weather.rain.chart) }),
    ).toBeInTheDocument();
  });

  it('renders the same content on the phone', async () => {
    show(radarWith(wetFrom20To45), weatherWith(new Array(16).fill(0)), 'phone');
    await flush();
    expect(screen.getByTestId('rain-statement')).toBeInTheDocument();
    expect(screen.getByTestId('rain-bars')).toBeInTheDocument();
  });
});
