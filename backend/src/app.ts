import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { SnapshotStore } from './cache/snapshot-store.js';
import type { Clock } from './clock.js';
import type { AppConfig } from './config/load-config.js';
import { registerErrorHandling } from './errors.js';
import { redactPaths, type LogOptions } from './logging.js';
import { healthRoute } from './routes/health.route.js';
import { snapshotRoute } from './routes/snapshot.route.js';
import type { Source } from './sources/source.js';

export interface AppDeps {
  config: AppConfig;
  store: SnapshotStore;
  clock: Clock;
  sources: readonly Source[];
  buildId: string;
  staticDir?: string;
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
    bodyLimit: BODY_LIMIT_BYTES,
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
    if (request.url.startsWith('/api/')) reply.header('cache-control', 'no-store');
    return payload;
  });

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
