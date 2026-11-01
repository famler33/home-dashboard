import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { de } from '../../i18n/de';
import { renderWithProviders } from '../../test-utils';
import { Credits } from './Credits';

// Covers: FR-14, NFR-6, AC-21, AC-40
describe('Credits', () => {
  it('shows the abbreviated credit on the wall', () => {
    renderWithProviders(<Credits variant="short" />);
    expect(screen.getByText('Open-Meteo · DWD · OSM')).toBeInTheDocument();
  });

  it('shows the full wording with all three sources on the phone', () => {
    renderWithProviders(<Credits variant="full" />);
    const text = screen.getByText(de.weather.credit.full).textContent ?? '';
    for (const name of ['Open-Meteo', 'Deutscher Wetterdienst', 'OpenStreetMap'])
      expect(text).toContain(name);
  });

  it('shows the radar credit with DWD and OpenStreetMap', () => {
    renderWithProviders(<Credits variant="radar" />);
    const text = screen.getByText(de.weather.credit.radar).textContent ?? '';
    expect(text).toContain('Deutscher Wetterdienst');
    expect(text).toContain('OpenStreetMap');
  });
});
