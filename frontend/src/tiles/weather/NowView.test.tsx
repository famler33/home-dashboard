import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { de } from '../../i18n/de';
import { renderWithProviders } from '../../test-utils';
import { NowView } from './NowView';
import { weatherNow, weatherSource } from './test-data';
import type { WeatherPayload } from './types';

const weather = () => weatherSource('weather').data as WeatherPayload;
const timeZone = 'Europe/Berlin';

function payload(change: (data: WeatherPayload) => void): WeatherPayload {
  const data = weather();
  change(data);
  return data;
}

beforeEach(() => {
  vi.useFakeTimers({ now: weatherNow });
});

// Covers: FR-1, FR-3, FR-4, AC-1, AC-4, AC-5, AC-6, AC-7, AC-8, AC-14
describe('NowView', () => {
  it('renders temperature, symbol, description and the day line', () => {
    const data = payload((d) => {
      d.current = { ...d.current, temperature: 12.4, condition: 'rain' };
      d.today = { max: 14, min: 8, precipProbability: 60 };
    });
    const { container } = renderWithProviders(
      <NowView weather={data} rain={null} layout="wall" timeZone={timeZone} />,
    );
    expect(screen.getAllByText('12°').length).toBeGreaterThan(0);
    expect(screen.getAllByText(de.weather.conditions.rain).length).toBeGreaterThan(0);
    expect(screen.getByText('Heute 8° / 14°, Regen 60 %')).toBeInTheDocument();
    expect(container.querySelector('svg[data-symbol="rain"]')).not.toBeNull();
  });

  it('shows the symbol of the current conditions in the night variant when it is night', () => {
    const data = payload((d) => (d.current = { ...d.current, isDay: false, condition: 'clear' }));
    const { container } = renderWithProviders(
      <NowView weather={data} rain={null} layout="wall" timeZone={timeZone} />,
    );
    expect(
      container.querySelector('svg[data-symbol="clear"][data-variant="night"]'),
    ).not.toBeNull();
  });

  it('hides wind below 40 km/h on the wall', () => {
    const data = payload((d) => (d.current = { ...d.current, windKmh: 39, windDirection: 312 }));
    renderWithProviders(<NowView weather={data} rain={null} layout="wall" timeZone={timeZone} />);
    expect(screen.queryByText(/Wind/)).toBeNull();
  });

  it('shows wind speed and direction from 40 km/h on the wall', () => {
    const data = payload((d) => (d.current = { ...d.current, windKmh: 47.6, windDirection: 312 }));
    renderWithProviders(<NowView weather={data} rain={null} layout="wall" timeZone={timeZone} />);
    expect(screen.getByText('Wind 48 km/h aus NW')).toBeInTheDocument();
  });

  it('always shows wind on the phone', () => {
    const data = payload((d) => (d.current = { ...d.current, windKmh: 9, windDirection: 90 }));
    renderWithProviders(<NowView weather={data} rain={null} layout="phone" timeZone={timeZone} />);
    expect(screen.getByText('Wind 9 km/h aus O')).toBeInTheDocument();
  });

  it('renders five hourly slots on the wall starting with the next full hour', () => {
    renderWithProviders(
      <NowView weather={weather()} rain={null} layout="wall" timeZone={timeZone} />,
    );
    const slots = screen.getAllByTestId('hour-slot');
    expect(slots).toHaveLength(5);
    expect(within(slots[0]!).getByText('15:00')).toBeInTheDocument();
    expect(within(slots[4]!).getByText('19:00')).toBeInTheDocument();
  });

  it('shows hour, symbol and temperature in each slot and the probability only from 20 percent', () => {
    const data = payload((d) => {
      d.hourly[0] = {
        ...d.hourly[0]!,
        temperature: 13.4,
        condition: 'rain',
        precipProbability: 19,
      };
      d.hourly[1] = {
        ...d.hourly[1]!,
        temperature: 12.6,
        condition: 'showers',
        precipProbability: 20,
      };
    });
    const { container } = renderWithProviders(
      <NowView weather={data} rain={null} layout="wall" timeZone={timeZone} />,
    );
    const [first, second] = screen.getAllByTestId('hour-slot');
    expect(within(first!).getByText('13°')).toBeInTheDocument();
    expect(within(first!).queryByText('19 %')).toBeNull();
    expect(within(second!).getByText('13°')).toBeInTheDocument();
    expect(within(second!).getByText('20 %')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="hour-slot"] svg').length).toBe(5);
  });

  it('keeps the slot symbol as screen-reader text in the compact variant', () => {
    renderWithProviders(
      <NowView weather={weather()} rain={null} layout="wall" timeZone={timeZone} />,
    );
    const [slot] = screen.getAllByTestId('hour-slot');
    const symbolWrapper = slot!.querySelector('svg')!.closest('[class*="tablet-short:sr-only"]');
    expect(symbolWrapper).not.toBeNull();
    expect(
      within(slot!).getByRole('img', { hidden: true }) ?? slot!.querySelector('[role="img"]'),
    ).toBeTruthy();
  });

  it('renders 24 hourly slots on the phone', () => {
    renderWithProviders(
      <NowView weather={weather()} rain={null} layout="phone" timeZone={timeZone} />,
    );
    expect(screen.getAllByTestId('hour-slot')).toHaveLength(24);
  });

  it.each([
    [{ kind: 'none' as const }, 'Kein Regen in den nächsten 2 Stunden'],
    [
      {
        kind: 'starts' as const,
        startsAt: Date.parse('2026-10-28T14:15:00Z'),
        durationMin: 40,
        beyondHorizon: false,
      },
      'Regen ab 15:15, ca. 40 Min.',
    ],
    [
      {
        kind: 'starts' as const,
        startsAt: Date.parse('2026-10-28T14:15:00Z'),
        durationMin: 45,
        beyondHorizon: true,
      },
      'Regen ab 15:15, mindestens 45 Min.',
    ],
    [
      {
        kind: 'raining' as const,
        endsAt: Date.parse('2026-10-28T14:30:00Z'),
        horizonEnd: Date.parse('2026-10-28T16:00:00Z'),
      },
      'Es regnet, Ende gegen 15:30',
    ],
    [
      { kind: 'raining' as const, endsAt: null, horizonEnd: Date.parse('2026-10-28T16:00:00Z') },
      'Es regnet, mindestens bis 17:00',
    ],
  ])('shows the rain line for %j', (statement, text) => {
    renderWithProviders(
      <NowView weather={weather()} rain={statement} layout="wall" timeZone={timeZone} />,
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('shows no rain line when no rain information is available', () => {
    renderWithProviders(
      <NowView weather={weather()} rain={null} layout="wall" timeZone={timeZone} />,
    );
    expect(screen.queryByTestId('rain-line')).toBeNull();
  });

  it('uses degree signs and no Fahrenheit', () => {
    renderWithProviders(
      <NowView weather={weather()} rain={null} layout="wall" timeZone={timeZone} />,
    );
    expect(document.body.textContent).not.toMatch(/°F/);
    expect(document.body.textContent).toMatch(/°/);
  });
});
