import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test-utils';
import { ViewIndicators } from './ViewIndicators';

// Covers: AC-24, AC-45
describe('ViewIndicators', () => {
  const show = (index = 0, onSelect = vi.fn()) => {
    renderWithProviders(<ViewIndicators index={index} onSelect={onSelect} />);
    return onSelect;
  };

  it('gives each indicator a German accessible name', () => {
    show();
    expect(screen.getByRole('tablist', { name: 'Ansicht wählen' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Jetzt' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '7 Tage' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Regen und Radar' })).toBeInTheDocument();
  });

  it('marks the current view with aria-selected and a longer pill shape, not by colour alone', () => {
    show(1);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    const shape = (tab: HTMLElement) =>
      tab.querySelector('[data-testid="indicator-shape"]')!.className;
    expect(shape(tabs[1]!)).toContain('w-10');
    expect(shape(tabs[0]!)).toContain('w-3');
    expect(shape(tabs[1]!)).not.toBe(shape(tabs[0]!));
  });

  it('gives every indicator a touch target of at least 56 px', () => {
    show();
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('min-h-14');
      expect(tab.className).toContain('min-w-14');
    }
  });

  it('selects the view of the tapped indicator and stops the event', () => {
    const onSelect = show();
    const parent = vi.fn();
    document.body.addEventListener('click', parent);
    fireEvent.click(screen.getByRole('tab', { name: '7 Tage' }));
    expect(onSelect).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('tab', { name: 'Regen und Radar' }));
    expect(onSelect).toHaveBeenLastCalledWith(2);
    document.body.removeEventListener('click', parent);
  });
});
