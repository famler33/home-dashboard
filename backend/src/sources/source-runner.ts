import type { SnapshotStore, SourceErrorCode } from '../cache/snapshot-store.js';
import type { Clock } from '../clock.js';
import type { Logger } from '../logger.js';
import type { Source } from './source.js';

export interface SourceRunner {
  refresh(source: Source): Promise<void>;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

export function createSourceRunner(deps: {
  store: SnapshotStore;
  clock: Clock;
  logger: Logger;
}): SourceRunner {
  const { store, clock, logger } = deps;

  return {
    async refresh(source) {
      const signal = AbortSignal.timeout(source.timeoutMs);
      const aborted = new Promise<never>((_, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('source timed out', 'TimeoutError')),
          { once: true },
        );
      });
      aborted.catch(() => {});

      try {
        const payload = await Promise.race([
          Promise.resolve().then(() => source.fetch(signal)),
          aborted,
        ]);
        store.recordSuccess(source.id, payload, clock.now());
      } catch (error) {
        const code: SourceErrorCode = isTimeout(error) ? 'SOURCE_TIMEOUT' : 'SOURCE_FETCH_FAILED';
        store.recordFailure(source.id, code, clock.now());
        logger.warn({ sourceId: source.id, code }, 'source refresh failed');
      }
    },
  };
}
