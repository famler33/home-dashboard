const RELOAD_GUARD_MS = 60_000;
const STORAGE_KEY = 'dashboard:lastReloadAt';

export type GuardStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function safeSessionStorage(): GuardStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function createReloader(deps: {
  reload: () => void;
  storage: GuardStorage | null;
  now: () => number;
}): { requestReload(): boolean } {
  let lastInMemory = Number.NEGATIVE_INFINITY;

  function lastStored(): number {
    try {
      const raw = deps.storage?.getItem(STORAGE_KEY);
      return raw ? Number(raw) : Number.NEGATIVE_INFINITY;
    } catch {
      return Number.NEGATIVE_INFINITY;
    }
  }

  return {
    requestReload() {
      const now = deps.now();
      if (now - Math.max(lastInMemory, lastStored()) < RELOAD_GUARD_MS) return false;
      lastInMemory = now;
      try {
        deps.storage?.setItem(STORAGE_KEY, String(now));
      } catch {
        // The in-memory guard still prevents a reload loop within this page.
      }
      deps.reload();
      return true;
    },
  };
}

function localParts(ms: number, timeZone: string): { key: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    key: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function localDateKey(ms: number, timeZone: string): string {
  return localParts(ms, timeZone).key;
}

/** True once per day: the page started before today's reload time and that time has passed. */
export function dailyReloadDue(args: {
  now: number;
  startedAt: number;
  timeZone: string;
  hhmm: string;
}): boolean {
  const [hours, minutes] = args.hhmm.split(':').map(Number);
  const target = (hours ?? 0) * 60 + (minutes ?? 0);
  const now = localParts(args.now, args.timeZone);
  const started = localParts(args.startedAt, args.timeZone);
  if (now.minutes < target) return false;
  return started.key < now.key || (started.key === now.key && started.minutes < target);
}
