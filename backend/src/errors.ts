import { Type } from '@sinclair/typebox';
import type { FastifyError, FastifyInstance } from 'fastify';

export type ApiErrorCode =
  'NOT_FOUND' | 'VALIDATION_FAILED' | 'PAYLOAD_TOO_LARGE' | 'INTERNAL_ERROR';

const messages: Record<ApiErrorCode, string> = {
  NOT_FOUND: 'Resource not found',
  VALIDATION_FAILED: 'Request is not valid',
  PAYLOAD_TOO_LARGE: 'Request body is too large',
  INTERNAL_ERROR: 'Internal server error',
};

export const errorEnvelopeSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    details: Type.Null(),
  }),
});

export function errorEnvelope(code: ApiErrorCode): {
  error: { code: ApiErrorCode; message: string; details: null };
} {
  return { error: { code, message: messages[code], details: null } };
}

export function registerErrorHandling(app: FastifyInstance, serveSpa: boolean): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    let code: ApiErrorCode;
    let httpStatus: number;

    if (status === 413) {
      code = 'PAYLOAD_TOO_LARGE';
      httpStatus = 413;
    } else if (status === 404) {
      code = 'NOT_FOUND';
      httpStatus = 404;
    } else if (status >= 400 && status < 500) {
      code = 'VALIDATION_FAILED';
      httpStatus = status;
    } else {
      request.log.error({ err: error }, 'unhandled request error');
      code = 'INTERNAL_ERROR';
      httpStatus = 500;
    }
    return reply.code(httpStatus).send(errorEnvelope(code));
  });

  app.setNotFoundHandler((request, reply) => {
    const isApi = request.url.startsWith('/api/');
    const readMethod = request.method === 'GET' || request.method === 'HEAD';
    if (serveSpa && !isApi && readMethod) {
      return reply.header('cache-control', 'no-cache').type('text/html').sendFile('index.html');
    }
    return reply.code(404).send(errorEnvelope('NOT_FOUND'));
  });
}
