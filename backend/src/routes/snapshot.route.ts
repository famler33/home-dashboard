import type { FastifyPluginAsync } from 'fastify';
import type { SnapshotStore } from '../cache/snapshot-store.js';
import type { Clock } from '../clock.js';
import { projectSettings, type AppConfig } from '../config/load-config.js';
import { errorEnvelopeSchema } from '../errors.js';
import { buildSnapshot } from '../snapshot/build-snapshot.js';
import { snapshotSchema } from '../snapshot/schema.js';
import type { Source } from '../sources/source.js';

export function snapshotRoute(deps: {
  config: AppConfig;
  store: SnapshotStore;
  clock: Clock;
  sources: readonly Source[];
  buildId: string;
}): FastifyPluginAsync {
  return async (app) => {
    app.get(
      '/api/v1/snapshot',
      { schema: { response: { 200: snapshotSchema, 500: errorEnvelopeSchema } } },
      async () =>
        buildSnapshot({
          sources: deps.sources,
          store: deps.store,
          settings: projectSettings(deps.config.settings),
          buildId: deps.buildId,
          now: deps.clock.now(),
        }),
    );
  };
}
