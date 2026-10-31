import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { errorEnvelope } from '../errors.js';
import { ListsError, type ListsService } from './lists-service.js';
import type { ListsState } from './lists-types.js';

const BODY_LIMIT = 4096;
const uuid = Type.String({
  pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
});
const idParams = Type.Object({ id: Type.String({ pattern: '^[a-z0-9-]{1,64}$' }) });
const priority = Type.Union([Type.Literal('high'), Type.Literal('medium'), Type.Literal('low')]);
const text = Type.String({ maxLength: 400 });
const effort = Type.Union([Type.Number({ minimum: 0, maximum: 99 }), Type.Null()]);

const createItemBody = Type.Object(
  {
    id: uuid,
    list: Type.Union([Type.Literal('shopping'), Type.Literal('todo')]),
    title: text,
    categoryId: Type.Optional(Type.String({ pattern: '^[a-z0-9-]{1,64}$' })),
    priority: Type.Optional(priority),
    effortHours: Type.Optional(effort),
    prerequisite: Type.Optional(Type.Union([text, Type.Null()])),
  },
  { additionalProperties: false },
);

const patchItemBody = Type.Object(
  {
    title: Type.Optional(text),
    checked: Type.Optional(Type.Boolean()),
    categoryId: Type.Optional(Type.String({ pattern: '^[a-z0-9-]{1,64}$' })),
    priority: Type.Optional(priority),
    effortHours: Type.Optional(effort),
    prerequisite: Type.Optional(Type.Union([text, Type.Null()])),
  },
  { additionalProperties: false, minProperties: 1 },
);

const createCategoryBody = Type.Object({ id: uuid, name: text }, { additionalProperties: false });
const renameCategoryBody = Type.Object({ name: text }, { additionalProperties: false });

function statusOf(error: ListsError): number {
  if (error.code === 'VALIDATION_FAILED') return 400;
  if (error.code === 'NOT_FOUND') return 404;
  return 409;
}

export function listsRoutes(service: ListsService): FastifyPluginAsync {
  async function run(reply: FastifyReply, action: () => ListsState, successCode = 200) {
    try {
      return reply.code(successCode).send(action());
    } catch (error) {
      if (error instanceof ListsError) {
        return reply.code(statusOf(error)).send(errorEnvelope(error.code));
      }
      throw error;
    }
  }

  return async (app) => {
    app.get('/api/v1/lists', async (_request, reply) => reply.send(service.state()));

    app.post(
      '/api/v1/lists/items',
      { bodyLimit: BODY_LIMIT, schema: { body: createItemBody } },
      async (request, reply) => {
        const body = request.body as Parameters<ListsService['addItem']>[0];
        try {
          const result = service.addItem(body);
          return reply.code(result.created ? 201 : 200).send(result.state);
        } catch (error) {
          if (error instanceof ListsError)
            return reply.code(statusOf(error)).send(errorEnvelope(error.code));
          throw error;
        }
      },
    );

    app.patch(
      '/api/v1/lists/items/:id',
      { bodyLimit: BODY_LIMIT, schema: { params: idParams, body: patchItemBody } },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        return run(reply, () =>
          service.patchItem(id, request.body as Parameters<ListsService['patchItem']>[1]),
        );
      },
    );

    app.delete(
      '/api/v1/lists/items/:id',
      { bodyLimit: BODY_LIMIT, schema: { params: idParams } },
      async (request, reply) =>
        run(reply, () => service.deleteItem((request.params as { id: string }).id)),
    );

    app.post(
      '/api/v1/lists/items/:id/restore',
      { bodyLimit: BODY_LIMIT, schema: { params: idParams } },
      async (request, reply) =>
        run(reply, () => service.restoreItem((request.params as { id: string }).id)),
    );

    app.post(
      '/api/v1/lists/categories',
      { bodyLimit: BODY_LIMIT, schema: { body: createCategoryBody } },
      async (request, reply) => {
        const body = request.body as { id: string; name: string };
        try {
          const result = service.addCategory(body);
          return reply.code(result.created ? 201 : 200).send(result.state);
        } catch (error) {
          if (error instanceof ListsError)
            return reply.code(statusOf(error)).send(errorEnvelope(error.code));
          throw error;
        }
      },
    );

    app.patch(
      '/api/v1/lists/categories/:id',
      { bodyLimit: BODY_LIMIT, schema: { params: idParams, body: renameCategoryBody } },
      async (request, reply) =>
        run(reply, () =>
          service.renameCategory(
            (request.params as { id: string }).id,
            (request.body as { name: string }).name,
          ),
        ),
    );

    app.delete(
      '/api/v1/lists/categories/:id',
      { bodyLimit: BODY_LIMIT, schema: { params: idParams } },
      async (request, reply) =>
        run(reply, () => service.deleteCategory((request.params as { id: string }).id)),
    );

    app.post(
      '/api/v1/lists/categories/:id/restore',
      { bodyLimit: BODY_LIMIT, schema: { params: idParams } },
      async (request, reply) =>
        run(reply, () => service.restoreCategory((request.params as { id: string }).id)),
    );
  };
}
