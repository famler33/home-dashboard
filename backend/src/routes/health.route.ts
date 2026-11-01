import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import type { SnapshotStore } from '../cache/snapshot-store.js';

export function healthRoute(deps: { store: SnapshotStore }): FastifyPluginAsync {
  return async (app) => {
    app.get(
      '/api/v1/health',
      {
        schema: {
          response: {
            200: Type.Object({ status: Type.Literal('ok') }),
            503: Type.Object({ status: Type.Literal('error') }),
          },
        },
      },
      async (_request, reply) => {
        let healthy: boolean;
        try {
          healthy = deps.store.ping();
        } catch {
          healthy = false;
        }
        if (!healthy) return reply.code(503).send({ status: 'error' });
        return { status: 'ok' };
      },
    );
  };
}
