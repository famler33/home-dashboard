import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import { renderWithProviders } from '../../test-utils';
import { weatherHeading } from './heading';
import { weatherSource } from './test-data';

// Covers: FR-1, AC-2
describe('weatherHeading', () => {
  it('contains the base title and the location name, the latter hidden on short screens', () => {
    const node = weatherHeading(weatherSource('weather').data, i18n.t.bind(i18n));
    renderWithProviders(<h2>{node}</h2>);
    expect(screen.getByRole('heading')).toHaveTextContent('Wetter · Zuhause');
    expect(screen.getByText('· Zuhause', { exact: false }).className).toContain(
      'tablet-short:hidden',
    );
  });

  it('returns null while no payload exists', () => {
    expect(weatherHeading(null, i18n.t.bind(i18n))).toBeNull();
    expect(weatherHeading({ nope: 1 }, i18n.t.bind(i18n))).toBeNull();
  });
});
