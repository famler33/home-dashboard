import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test-utils';
import { DaysView } from './DaysView';
import { weatherNow, weatherSource } from './test-data';
import type { WeatherPayload } from './types';

const weather = () => weatherSource('weather').data as WeatherPayload;

beforeEach(() => {
  vi.useFakeTimers({ now: weatherNow });
});

// Covers: FR-5, AC-9, AC-10, AC-11
describe('DaysView', () => {
  it('renders seven days with German weekday, symbol, high and low', () => {
    const data = weather();
    data.daily[1] = { ...data.daily[1]!, max: 12.4, min: 6.2, condition: 'rain' };
    const { container } = renderWithProviders(<DaysView weather={data} layout="wall" />);
    const days = screen.getAllByTestId('day');
    expect(days).toHaveLength(7);
    expect(within(days[0]!).getByText('Heute')).toBeInTheDocument();
    expect(within(days[1]!).getByText('Do.')).toBeInTheDocument();
    expect(within(days[1]!).getByText('12°')).toBeInTheDocument();
    expect(within(days[1]!).getByText('6°')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="day"] svg')).toHaveLength(7);
  });

  it('shows the rain probability only from 20 percent', () => {
    const data = weather();
    data.daily[2] = { ...data.daily[2]!, precipProbability: 19 };
    data.daily[3] = { ...data.daily[3]!, precipProbability: 20 };
    renderWithProviders(<DaysView weather={data} layout="wall" />);
    const days = screen.getAllByTestId('day');
    expect(within(days[2]!).queryByText(/%/)).toBeNull();
    expect(within(days[3]!).getByText('20%')).toBeInTheDocument();
  });

  it('writes the probability with a space on the phone', () => {
    const data = weather();
    data.daily[3] = { ...data.daily[3]!, precipProbability: 20 };
    renderWithProviders(<DaysView weather={data} layout="phone" />);
    expect(within(screen.getAllByTestId('day')[3]!).getByText('20 %')).toBeInTheDocument();
  });

  it('keeps the day symbols as screen-reader text in the compact variant', () => {
    renderWithProviders(<DaysView weather={weather()} layout="wall" />);
    const [day] = screen.getAllByTestId('day');
    expect(day!.querySelector('svg')!.closest('[class*="tablet-short:sr-only"]')).not.toBeNull();
  });

  it('renders the same seven days as a list on the phone', () => {
    renderWithProviders(<DaysView weather={weather()} layout="phone" />);
    expect(screen.getAllByTestId('day')).toHaveLength(7);
    expect(screen.getByRole('list')).toBeInTheDocument();
  });
});
