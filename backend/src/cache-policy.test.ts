import { describe, expect, it } from 'vitest';
import { cacheableApiRoutes, isCacheableApiRoute } from './cache-policy.js';
import { errorEnvelope } from './errors.js';

// Covers: NFR-4, AC-19, AC-36 (cache rule and error codes)
describe('cache policy', () => {
  it('lists exactly the radar document and the basemap tiles as cacheable', () => {
    expect(cacheableApiRoutes).toEqual(['/api/v1/weather/radar', '/api/v1/weather/basemap/']);
  });

  it.each([
    ['/api/v1/weather/radar', true],
    ['/api/v1/weather/basemap/9/275/168', true],
    ['/api/v1/weather/radar/extra', false],
    ['/api/v1/snapshot', false],
    ['/api/v1/health', false],
    ['/api/v1/weather', false],
    ['/api/v1/weather/basemapx/1', false],
  ])('treats %s as cacheable=%s', (url, expected) => {
    expect(isCacheableApiRoute(url)).toBe(expected);
  });

  it('ignores query strings when matching', () => {
    expect(isCacheableApiRoute('/api/v1/weather/radar?x=1')).toBe(true);
  });
});

describe('error envelope codes for weather', () => {
  it('has English developer messages for the new codes', () => {
    expect(errorEnvelope('RADAR_NOT_AVAILABLE').error).toEqual({
      code: 'RADAR_NOT_AVAILABLE',
      message: expect.stringMatching(/radar/i),
      details: null,
    });
    expect(errorEnvelope('UPSTREAM_UNAVAILABLE').error.code).toBe('UPSTREAM_UNAVAILABLE');
  });
});
