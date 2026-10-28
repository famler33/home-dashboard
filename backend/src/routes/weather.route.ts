import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync } from 'fastify';
import { errorEnvelope } from '../errors.js';
import { NotAllowedError, type BasemapService } from '../sources/weather/basemap.js';
import { UpstreamError } from '../sources/weather/http.js';
import type { RadarStore } from '../sources/weather/radar-store.js';

export interface WeatherDeps {
  radarStore: RadarStore;
  basemap: BasemapService;
}

const tileParams = Type.Object({
  z: Type.String({ pattern: '^\\d{1,2}$' }),
  x: Type.String({ pattern: '^\\d{1,7}$' }),
  y: Type.String({ pattern: '^\\d{1,7}$' }),
});

export function weatherRoutes(deps: WeatherDeps): FastifyPluginAsync {
  return async (app) => {
    app.get('/api/v1/weather/radar', async (request, reply) => {
      const stored = deps.radarStore.load();
      if (!stored) {
        return reply
          .code(404)
          .header('cache-control', 'no-store')
          .send(errorEnvelope('RADAR_NOT_AVAILABLE'));
      }
      const etag = `"${stored.version}"`;
      reply.header('etag', etag).header('cache-control', 'no-cache');
      if (request.headers['if-none-match'] === etag) return reply.code(304).send();
      return reply
        .header('content-type', 'application/json; charset=utf-8')
        .header('content-encoding', 'gzip')
        .send(stored.bodyGzip);
    });

    app.get(
      '/api/v1/weather/basemap/:z/:x/:y',
      { schema: { params: tileParams } },
      async (request, reply) => {
        const { z, x, y } = request.params as { z: string; x: string; y: string };
        try {
          const png = await deps.basemap.get(
            Number(z),
            Number(x),
            Number(y),
            AbortSignal.timeout(15_000),
          );
          return reply
            .header('content-type', 'image/png')
            .header('cache-control', 'private, max-age=86400')
            .send(png);
        } catch (error) {
          reply.header('cache-control', 'no-store');
          if (error instanceof NotAllowedError)
            return reply.code(404).send(errorEnvelope('NOT_FOUND'));
          if (
            error instanceof UpstreamError ||
            (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
          ) {
            return reply.code(502).send(errorEnvelope('UPSTREAM_UNAVAILABLE'));
          }
          throw error;
        }
      },
    );
  };
}
