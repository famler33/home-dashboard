import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { LogController, type FastifyInstance } from 'fastify';
import type { SnapshotStore } from './cache/snapshot-store.js';
import { isCacheableApiRoute } from './cache-policy.js';
import type { Clock } from './clock.js';
import type { AppConfig } from './config/load-config.js';
import { registerErrorHandling } from './errors.js';
import { registerRequestGuard } from './request-guard.js';
import { redactPaths, type LogOptions } from './logging.js';
import { listsRoutes } from './lists/lists-routes.js';
import type { ListsService } from './lists/lists-service.js';
import { healthRoute } from './routes/health.route.js';
import { snapshotRoute } from './routes/snapshot.route.js';
import { weatherRoutes, type WeatherDeps } from './routes/weather.route.js';
import type { Source } from './sources/source.js';

export interface AppDeps {
  config: AppConfig;
  store: SnapshotStore;
  clock: Clock;
  sources: readonly Source[];
  buildId: string;
  staticDir?: string;
  weather?: WeatherDeps;
  lists?: ListsService;
  logger?: LogOptions;
}

const BODY_LIMIT_BYTES = 64 * 1024;

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.logger?.level ?? 'info',
      redact: { paths: redactPaths, censor: '[redacted]' },
      ...(deps.logger?.stream ? { stream: deps.logger.stream } : {}),
    },
    // The compose health check runs every 30 s; its request lines would only add noise.
    logController: new LogController({
      disableRequestLogging: (request) => request.url === '/api/v1/health',
    }),
    bodyLimit: BODY_LIMIT_BYTES,
    // Schemas reject unknown properties and wrong types instead of silently fixing them.
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } },
    requestTimeout: 15_000,
    connectionTimeout: 15_000,
    keepAliveTimeout: 5_000,
  });

  await app.register(fastifyHelmet, {
    hsts: false,
    referrerPolicy: { policy: 'no-referrer' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'"],
        styleSrcAttr: ["'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/') && !isCacheableApiRoute(request.url)) {
      reply.header('cache-control', 'no-store');
    }
    return payload;
  });

  // A bodiless request that still says it is JSON (retries of POST and DELETE) is not an error.
  const parseJson = app.getDefaultJsonParser('error', 'error');
  // The API speaks JSON only: anything else (including text/plain) is answered with 415.
  app.removeContentTypeParser('text/plain');
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (body === '') return done(null, undefined);
    return parseJson(request, body as string, done);
  });

  registerRequestGuard(app, deps.config.settings.network?.allowedHosts ?? []);
  registerErrorHandling(app, deps.staticDir !== undefined);

  await app.register(healthRoute({ store: deps.store }));
  await app.register(
    snapshotRoute({
      config: deps.config,
      store: deps.store,
      clock: deps.clock,
      sources: deps.sources,
      buildId: deps.buildId,
    }),
  );

  if (deps.weather) await app.register(weatherRoutes(deps.weather));
  if (deps.lists) await app.register(listsRoutes(deps.lists));

  if (deps.staticDir !== undefined) {
    await app.register(fastifyStatic, {
      root: deps.staticDir,
      wildcard: false,
      cacheControl: false,
      setHeaders(res, path) {
        const hashedAsset = path.includes('/assets/');
        res.header(
          'cache-control',
          hashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }

  await app.ready();
  return app;
}
