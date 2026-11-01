import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockMatchMedia, renderWithProviders } from '../test-utils';
import { Clock } from './Clock';

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse('2026-10-28T14:04:50Z') });
});

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

// Covers: FR-1, F-1, AC-1, AC-6
describe('Clock', () => {
  it('renders the time and a German long date', () => {
    renderWithProviders(<Clock timeZone="UTC" />);
    expect(screen.getByLabelText('Es ist 14:04 Uhr')).toBeInTheDocument();
    expect(screen.getByText('Mittwoch, 28. Oktober 2026')).toBeInTheDocument();
  });

  it('uses the configured time zone', () => {
    renderWithProviders(<Clock timeZone="Europe/Berlin" />);
    expect(screen.getByLabelText('Es ist 15:04 Uhr')).toBeInTheDocument();
  });

  it('hides the individual digits from assistive technology', () => {
    const { container } = renderWithProviders(<Clock timeZone="UTC" />);
    const digits = container.querySelectorAll('[aria-hidden="true"]');
    expect(digits.length).toBeGreaterThanOrEqual(4);
  });

  it('renders both the leaving and entering digit during a transition', async () => {
    renderWithProviders(<Clock timeZone="UTC" />);
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
    await advance(15_000);
    expect(screen.getByLabelText('Es ist 14:05 Uhr')).toBeInTheDocument();
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4').length).toBeGreaterThan(1);
  });

  it('swaps digits without movement when reduced motion is requested', async () => {
    mockMatchMedia((query) => query.includes('prefers-reduced-motion'));
    renderWithProviders(<Clock timeZone="UTC" />);
    await advance(15_000);
    expect(screen.getByLabelText('Es ist 14:05 Uhr')).toBeInTheDocument();
    expect(screen.getAllByText('5')).toHaveLength(1);
    expect(screen.getAllByText('4')).toHaveLength(1);
  });

  it('clears its interval on unmount', () => {
    const { unmount } = renderWithProviders(<Clock timeZone="UTC" />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('offers a compact date next to the clock on short screens', () => {
    renderWithProviders(<Clock timeZone="UTC" />);
    const long = screen.getByText('Mittwoch, 28. Oktober 2026');
    expect(long.className).toContain('tablet-short:hidden');
    const short = screen.getByText('Mi., 28.10.2026');
    expect(short.className).toContain('tablet-short:inline');
    expect(short).toHaveAttribute('aria-hidden', 'true');
  });
});
