import type { Source } from '../sources/source.js';
import type { ListsService } from './lists-service.js';
import type { ListsSummary } from './lists-types.js';

/**
 * The lists live in SQLite; this source only purges what expired and rebuilds the compact
 * summary for the snapshot, so an idle list is refreshed regularly and never looks stale.
 */
export function createListsSource(service: ListsService, now: () => number): Source<ListsSummary> {
  return {
    id: 'lists',
    intervalSeconds: 900,
    staleAfterSeconds: 7200,
    timeoutMs: 5000,
    async fetch() {
      service.purge(now());
      return service.summary();
    },
  };
}
