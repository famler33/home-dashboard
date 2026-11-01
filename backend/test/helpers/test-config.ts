import type { AppConfig } from '../../src/config/load-config.js';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    settings: {
      timezone: 'Europe/Berlin',
      location: { name: 'Zuhause', latitude: 52.52, longitude: 13.405 },
      display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
      sources: { demo: { enabled: true } },
      backup: { time: '03:00', retention: 14 },
    },
    credentials: {},
    warnings: [],
    ...overrides,
  };
}
