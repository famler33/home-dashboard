import { startServer } from './server.js';

try {
  const server = await startServer(process.env);
  console.info(JSON.stringify({ level: 'info', msg: 'dashboard started', url: server.url }));

  const shutdown = (signal: string): void => {
    console.info(JSON.stringify({ level: 'info', msg: 'shutting down', signal }));
    server
      .stop()
      .catch(() => {})
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  // Configuration and startup errors name keys and files, never values.
  console.error(
    JSON.stringify({
      level: 'fatal',
      msg: 'startup failed',
      error: error instanceof Error ? error.message : 'unknown error',
    }),
  );
  process.exit(1);
}
