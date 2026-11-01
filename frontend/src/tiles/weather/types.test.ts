import { describe, expect, it } from 'vitest';
import golden from '../../../../backend/test/fixtures/weather.snapshot.sample.json';
import { isSnapshot } from '../../api/types';
import { de } from '../../i18n/de';
import { isAlertsPayload, isRadarDocument, isRadarPayload, isWeatherPayload } from './types';
import { radarDocumentFixture } from './test-data';

const source = (id: string) => golden.sources.find((entry) => entry.id === id)!;

// Covers: FR-1, FR-6, FR-11, AC-1, AC-31 (contract with the backend)
describe('weather payload contract', () => {
  it('accepts the golden snapshot and its three weather entries', () => {
    expect(isSnapshot(golden)).toBe(true);
    expect(isWeatherPayload(source('weather').data)).toBe(true);
    expect(isRadarPayload(source('weather-radar').data)).toBe(true);
    expect(isAlertsPayload(source('weather-alerts').data)).toBe(true);
  });

  it('accepts a radar document with a grid of the announced size', () => {
    expect(isRadarDocument(radarDocumentFixture())).toBe(true);
  });

  it.each([
    ['null', null],
    ['a missing current block', { ...source('weather').data, current: undefined }],
    [
      'an unknown condition',
      {
        ...source('weather').data,
        current: {
          ...(source('weather').data as { current: object }).current,
          condition: 'tornado',
        },
      },
    ],
    ['hourly that is not an array', { ...source('weather').data, hourly: 'x' }],
  ])('rejects a weather payload with %s', (_label, value) => {
    expect(isWeatherPayload(value)).toBe(false);
  });

  it('rejects a radar document whose frames have the wrong length', () => {
    const doc = radarDocumentFixture();
    doc.frames[0]!.values = 'AAAA';
    expect(isRadarDocument(doc)).toBe(false);
  });

  it('rejects alerts with an unknown severity', () => {
    expect(
      isAlertsPayload({
        alerts: [{ id: '1', type: 'Sturm', severity: 'apocalyptic', onset: 'x', expires: 'y' }],
      }),
    ).toBe(false);
  });

  it('has an errors entry for the weather error codes', () => {
    expect(de.errors).toHaveProperty('RADAR_NOT_AVAILABLE');
    expect(de.errors).toHaveProperty('UPSTREAM_UNAVAILABLE');
  });
});
