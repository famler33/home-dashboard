import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, projectSettings } from './load-config.js';

const validSettings = `
timezone: Europe/Berlin
location:
  name: Zuhause
  latitude: 52.52
  longitude: 13.405
display:
  nightFrom: "22:00"
  nightTo: "06:30"
  dailyReloadAt: "04:00"
sources:
  demo:
    enabled: false
backup:
  time: "03:00"
  retention: 14
`;

let dir: string;

function write(name: string, content: string, mode = 0o600): void {
  const path = join(dir, name);
  writeFileSync(path, content);
  chmodSync(path, mode);
}

function load() {
  return loadConfig({ CONFIG_DIR: dir });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dashboard-config-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Covers: FR-17, FR-25, AC-26
describe('loadConfig', () => {
  it('loads settings from CONFIG_DIR', () => {
    write('settings.yaml', validSettings);
    const config = load();
    expect(config.settings.timezone).toBe('Europe/Berlin');
    expect(config.settings.display.nightFrom).toBe('22:00');
    expect(config.settings.backup.retention).toBe(14);
    expect(config.credentials).toEqual({});
  });

  it('reflects a changed nightFrom in the projected settings', () => {
    write('settings.yaml', validSettings.replace('"22:00"', '"23:15"'));
    expect(projectSettings(load().settings).display.nightFrom).toBe('23:15');
  });

  it('treats a missing sources.weather key as enabled and accepts an explicit switch', () => {
    write('settings.yaml', validSettings);
    expect(load().settings.sources.weather?.enabled ?? true).toBe(true);
    write(
      'settings.yaml',
      validSettings.replace(
        'demo:\n    enabled: false',
        'demo:\n    enabled: false\n  weather:\n    enabled: false',
      ),
    );
    expect(load().settings.sources.weather?.enabled).toBe(false);
  });

  it('treats a missing sources.news key as enabled and accepts an explicit switch', () => {
    write('settings.yaml', validSettings);
    expect(load().settings.sources.news?.enabled ?? true).toBe(true);
    write(
      'settings.yaml',
      validSettings.replace(
        'demo:\n    enabled: false',
        'demo:\n    enabled: false\n  news:\n    enabled: false',
      ),
    );
    expect(load().settings.sources.news?.enabled).toBe(false);
  });

  it('rejects unknown keys under sources.news', () => {
    write(
      'settings.yaml',
      validSettings.replace(
        'demo:\n    enabled: false',
        'demo:\n    enabled: false\n  news:\n    enabled: true\n    url: https://example.org/feed',
      ),
    );
    expect(() => load()).toThrow();
  });

  it('rejects a weather switch that is not a boolean naming the key', () => {
    write(
      'settings.yaml',
      validSettings.replace(
        'demo:\n    enabled: false',
        'demo:\n    enabled: false\n  weather:\n    enabled: SECRET-BAD',
      ),
    );
    let message = '';
    try {
      load();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('sources.weather.enabled');
    expect(message).not.toContain('SECRET-BAD');
  });

  it('rejects a missing settings file naming the file', () => {
    expect(() => load()).toThrowError(ConfigError);
    expect(() => load()).toThrowError(/settings\.yaml/);
  });

  it.each([
    ['a malformed time', validSettings.replace('"22:00"', '"SECRET-BAD"'), 'display.nightFrom'],
    [
      'an unknown timezone',
      validSettings.replace('Europe/Berlin', 'Nowhere/SECRET-BAD'),
      'timezone',
    ],
    [
      'a retention of zero',
      validSettings.replace('retention: 14', 'retention: 0'),
      'backup.retention',
    ],
    ['an unknown key', `${validSettings}\nsurprise: SECRET-BAD\n`, 'surprise'],
    ['a missing section', validSettings.replace(/backup:[\s\S]*$/, ''), 'backup'],
  ])('rejects %s naming the key but not the value', (_label, content, key) => {
    write('settings.yaml', content);
    let message = '';
    try {
      load();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(key);
    expect(message).not.toContain('SECRET-BAD');
  });

  it('rejects unparsable YAML without echoing its content', () => {
    write('settings.yaml', 'timezone: [SECRET-BAD\n');
    expect(() => load()).toThrowError(/settings\.yaml/);
    expect(() => load()).not.toThrowError(/SECRET-BAD/);
  });

  it('projects only the timezone and the display settings', () => {
    write('settings.yaml', validSettings);
    const projection = projectSettings(load().settings);
    expect(projection).toEqual({
      timezone: 'Europe/Berlin',
      display: { nightFrom: '22:00', nightTo: '06:30', dailyReloadAt: '04:00' },
    });
    expect(JSON.stringify(projection)).not.toContain('52.52');
    expect(JSON.stringify(projection)).not.toContain('backup');
  });
});

// Covers: FR-17, NFR-5, AC-27
describe('loadConfig credentials', () => {
  it('reads credentials per source id', () => {
    write('settings.yaml', validSettings);
    write('credentials.yaml', 'weather:\n  apiKey: S3CR3T-TEST\n');
    expect(load().credentials).toEqual({ weather: { apiKey: 'S3CR3T-TEST' } });
  });

  it('warns about group or world readable credentials without printing values', () => {
    write('settings.yaml', validSettings);
    write('credentials.yaml', 'weather:\n  apiKey: S3CR3T-TEST\n', 0o644);
    const warnings = load().warnings.filter((warning) => warning.includes('credentials.yaml'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/credentials\.yaml/);
    expect(warnings[0]).not.toContain('S3CR3T-TEST');
  });

  it('does not warn for mode 0600', () => {
    write('settings.yaml', validSettings);
    write('credentials.yaml', 'weather:\n  apiKey: x\n', 0o600);
    expect(load().warnings.filter((warning) => warning.includes('credentials.yaml'))).toEqual([]);
  });

  it('rejects malformed credentials without echoing values', () => {
    write('settings.yaml', validSettings);
    write('credentials.yaml', 'weather: S3CR3T-TEST\n');
    let message = '';
    try {
      load();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('credentials.yaml');
    expect(message).not.toContain('S3CR3T-TEST');
  });
});

const calendarBlock = `
  calendar:
    enabled: true
    kitaKeyword: Kita
    calendars:
      family:
        enabled: true
        name: Familie
        color: blue
      person-1:
        enabled: false
        name: Alex
        color: green
        selfAddresses: [alex@example.com]
      person-2:
        enabled: false
        name: Ben
        color: orange
`;
const withCalendar = validSettings.replace('sources:\n', `sources:\n${calendarBlock.slice(1)}`);
const goodUrl = 'webcal://p12-caldav.icloud.com/published/2/SECRET-TOKEN';

// Covers: FR-9, AC-15, AC-26, AC-30, AC-34
describe('loadConfig calendar settings', () => {
  it('accepts the calendar block and requires a feed url only for enabled calendars', () => {
    write('settings.yaml', withCalendar);
    write('credentials.yaml', `calendar-family:\n  url: ${goodUrl}\n`);
    const config = load();
    expect(config.settings.sources.calendar?.calendars.family.name).toBe('Familie');
  });

  it('fails naming credentials.yaml and the key when an enabled calendar has no url', () => {
    write('settings.yaml', withCalendar);
    expect(() => load()).toThrowError(/credentials\.yaml: calendar-family\.url/);
  });

  it('fails naming the key but never the value for a url outside the allow-list', () => {
    write('settings.yaml', withCalendar);
    write('credentials.yaml', 'calendar-family:\n  url: https://example.org/SECRET-TOKEN\n');
    try {
      load();
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain('calendar-family.url');
      expect((error as Error).message).not.toContain('SECRET-TOKEN');
      expect((error as Error).message).not.toContain('example.org');
    }
  });

  it('does not check urls of disabled calendars or of a disabled tile', () => {
    write(
      'settings.yaml',
      withCalendar.replace('enabled: true\n    kita', 'enabled: false\n    kita'),
    );
    expect(() => load()).not.toThrow();
  });

  it('rejects an unknown colour and an empty name naming the key', () => {
    write('settings.yaml', withCalendar.replace('color: blue', 'color: pink'));
    expect(() => load()).toThrowError(/sources\.calendar\.calendars\.family\.color/);
    write('settings.yaml', withCalendar.replace('name: Familie', 'name: ""'));
    expect(() => load()).toThrowError(/sources\.calendar\.calendars\.family\.name/);
  });

  it('validates kitaKeyword between 1 and 30 characters', () => {
    write('settings.yaml', withCalendar.replace('kitaKeyword: Kita', 'kitaKeyword: ""'));
    expect(() => load()).toThrowError(/kitaKeyword/);
  });

  it('projects name, colour and role of enabled calendars and nothing else', () => {
    write('settings.yaml', withCalendar);
    write('credentials.yaml', `calendar-family:\n  url: ${goodUrl}\n`);
    const projected = projectSettings(load().settings);
    expect(projected.calendar).toEqual({
      kitaKeyword: 'Kita',
      calendars: [{ id: 'family', name: 'Familie', color: 'blue', role: 'family' }],
    });
    const text = JSON.stringify(projected);
    expect(text).not.toContain('SECRET-TOKEN');
    expect(text).not.toContain('alex@example.com');
  });

  it('projects no calendar block when the tile is off or absent', () => {
    write('settings.yaml', validSettings);
    expect(projectSettings(load().settings).calendar).toBeUndefined();
  });
});

// Covers: NFR-3, AC-5 (network.allowedHosts)
describe('loadConfig network settings', () => {
  it('accepts a list of lowercase host names and IPv6 literals', () => {
    write(
      'settings.yaml',
      validSettings.replace(
        'backup:',
        'network:\n  allowedHosts: [dashboard.home, 192.168.1.20, "[::1]"]\nbackup:',
      ),
    );
    expect(load().settings.network?.allowedHosts).toEqual([
      'dashboard.home',
      '192.168.1.20',
      '[::1]',
    ]);
    expect(load().warnings.join('\n')).not.toContain('allowedHosts');
  });

  it('rejects schemes, ports, wildcards, uppercase and empty lists naming the key', () => {
    for (const bad of [
      'http://dashboard.home',
      'dashboard.home:8080',
      '*.home',
      'Dashboard.Home',
    ]) {
      write(
        'settings.yaml',
        validSettings.replace('backup:', `network:\n  allowedHosts: ["${bad}"]\nbackup:`),
      );
      expect(() => load(), bad).toThrowError(/network\.allowedHosts/);
    }
    write(
      'settings.yaml',
      validSettings.replace('backup:', 'network:\n  allowedHosts: []\nbackup:'),
    );
    expect(() => load()).toThrowError(/network\.allowedHosts/);
  });

  it('warns that only loopback is allowed when the setting is missing', () => {
    write('settings.yaml', validSettings);
    expect(load().warnings.join('\n')).toContain('network.allowedHosts is not set');
  });
});
