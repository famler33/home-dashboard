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
    const { warnings } = load();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/credentials\.yaml/);
    expect(warnings[0]).not.toContain('S3CR3T-TEST');
  });

  it('does not warn for mode 0600', () => {
    write('settings.yaml', validSettings);
    write('credentials.yaml', 'weather:\n  apiKey: x\n', 0o600);
    expect(load().warnings).toEqual([]);
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
