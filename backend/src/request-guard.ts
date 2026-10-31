import type { FastifyInstance } from 'fastify';
import { errorEnvelope } from './errors.js';

const loopback = ['localhost', '127.0.0.1', '[::1]'];
const mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** The host name of a Host header value or an origin host: lowercase, without the port. */
function hostName(value: string): string {
  const text = value.trim().toLowerCase();
  if (text.startsWith('[')) {
    const end = text.indexOf(']');
    return end === -1 ? text : text.slice(0, end + 1);
  }
  const colon = text.indexOf(':');
  return colon === -1 ? text : text.slice(0, colon);
}

/**
 * Guards every `/api/` request without a login: the Host must be an allowed name (stops DNS
 * rebinding), and mutations must not come from another origin or site. Requests without an
 * Origin header (curl, scripts on the NAS) pass the origin rule.
 */
export function registerRequestGuard(app: FastifyInstance, allowedHosts: readonly string[]): void {
  const allowed = new Set([...loopback, ...allowedHosts.map((host) => host.toLowerCase())]);

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;

    const host = hostName(request.headers.host ?? '');
    if (!allowed.has(host)) {
      return reply.code(403).send(errorEnvelope('FORBIDDEN_HOST'));
    }
    if (!mutating.has(request.method)) return;

    const origin = request.headers.origin;
    if (origin !== undefined) {
      let originHost: string;
      try {
        originHost = hostName(new URL(origin).host);
      } catch {
        originHost = '';
      }
      if (originHost === '' || originHost !== host) {
        return reply.code(403).send(errorEnvelope('FORBIDDEN_HOST'));
      }
    }
    if (request.headers['sec-fetch-site'] === 'cross-site') {
      return reply.code(403).send(errorEnvelope('FORBIDDEN_HOST'));
    }
    return undefined;
  });
}
