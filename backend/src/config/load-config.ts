import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { parse } from 'yaml';
import {
  credentialsSchema,
  settingsSchema,
  type Credentials,
  type Settings,
  type SnapshotSettings,
} from './schema.js';
import { calendarIds } from './schema.js';
import { FeedRejected, normaliseFeedUrl } from '../sources/calendar/feed-url.js';

export type { Credentials, Settings, SnapshotSettings } from './schema.js';

export interface AppConfig {
  settings: Settings;
  credentials: Credentials;
  warnings: readonly string[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

interface FileReader {
  read(path: string): string | undefined;
  mode(path: string): number | undefined;
}

const nodeFiles: FileReader = {
  read(path) {
    try {
      return readFileSync(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new ConfigError(
          `${path}: file is not readable by the container user; check file owner and the UID/GID in the compose settings`,
        );
      }
      throw new ConfigError(`${path}: file could not be read`);
    }
  },
  mode(path) {
    try {
      return statSync(path).mode;
    } catch {
      return undefined;
    }
  },
};

function parseYaml(name: string, text: string): unknown {
  try {
    return parse(text) ?? {};
  } catch {
    throw new ConfigError(`${name}: not valid YAML`);
  }
}

function validate<T extends TSchema>(name: string, schema: T, data: unknown): void {
  const problems = [...Value.Errors(schema, data)].map((issue) => {
    const key = issue.path.replace(/^\//, '').replaceAll('/', '.') || '(root)';
    return `${key}: ${issue.message}`;
  });
  if (problems.length > 0) {
    throw new ConfigError(`${name}: ${problems.join('; ')}`);
  }
}

function assertTimezone(zone: string): void {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
  } catch {
    throw new ConfigError('settings.yaml: timezone: is not a known IANA time zone');
  }
}

export function loadConfig(env: NodeJS.ProcessEnv, files: FileReader = nodeFiles): AppConfig {
  const dir = env['CONFIG_DIR'] ?? '/config';
  const warnings: string[] = [];

  const settingsText = files.read(join(dir, 'settings.yaml'));
  if (settingsText === undefined) {
    throw new ConfigError('settings.yaml: file not found in the configuration directory');
  }
  const settingsData = parseYaml('settings.yaml', settingsText);
  validate('settings.yaml', settingsSchema, settingsData);
  const settings = settingsData as Settings;
  assertTimezone(settings.timezone);

  let credentials: Credentials = {};
  const credentialsPath = join(dir, 'credentials.yaml');
  const credentialsText = files.read(credentialsPath);
  if (credentialsText !== undefined) {
    const credentialsData = parseYaml('credentials.yaml', credentialsText);
    validate('credentials.yaml', credentialsSchema, credentialsData);
    credentials = credentialsData as Credentials;
    const mode = files.mode(credentialsPath);
    if (mode !== undefined && (mode & 0o077) !== 0) {
      warnings.push(
        'credentials.yaml: file is readable by group or others; restrict it to mode 0600',
      );
    }
  }

  assertCalendarFeeds(settings, credentials);
  if (!settings.network) {
    warnings.push(
      'settings.yaml: network.allowedHosts is not set; only localhost, 127.0.0.1 and [::1] are allowed',
    );
  }

  return { settings, credentials, warnings };
}

/** Enabled calendars need a valid feed address; errors name the file and key, never the value. */
function assertCalendarFeeds(settings: Settings, credentials: Credentials): void {
  const calendar = settings.sources.calendar;
  if (!calendar || !calendar.enabled) return;
  for (const id of calendarIds) {
    if (!calendar.calendars[id].enabled) continue;
    const key = `calendar-${id}`;
    const url = credentials[key]?.['url'];
    if (url === undefined) {
      throw new ConfigError(`credentials.yaml: ${key}.url: is required for an enabled calendar`);
    }
    try {
      normaliseFeedUrl(url);
    } catch (error) {
      if (error instanceof FeedRejected) {
        throw new ConfigError(
          `credentials.yaml: ${key}.url: is not an allowed https calendar address`,
        );
      }
      throw error;
    }
  }
}

export function projectSettings(settings: Settings): SnapshotSettings {
  const projected: SnapshotSettings = {
    timezone: settings.timezone,
    display: {
      nightFrom: settings.display.nightFrom,
      nightTo: settings.display.nightTo,
      dailyReloadAt: settings.display.dailyReloadAt,
    },
  };
  const calendar = settings.sources.calendar;
  if (calendar?.enabled) {
    projected.calendar = {
      kitaKeyword: calendar.kitaKeyword,
      calendars: calendarIds.flatMap((id) => {
        const entry = calendar.calendars[id];
        return entry.enabled
          ? [
              {
                id,
                name: entry.name,
                color: entry.color,
                role: id === 'family' ? ('family' as const) : ('person' as const),
              },
            ]
          : [];
      }),
    };
  }
  return projected;
}
