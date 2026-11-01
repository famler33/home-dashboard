import { Type, type Static } from '@sinclair/typebox';

export const newsHeadlineSchema = Type.Object({
  id: Type.String({ maxLength: 100 }),
  title: Type.String({ minLength: 1, maxLength: 160 }),
  publishedAt: Type.String({ minLength: 10 }),
});

export const newsPayloadSchema = Type.Object({
  group: Type.Union([Type.Literal('local'), Type.Literal('global')]),
  sourceName: Type.String({ minLength: 1 }),
  headlines: Type.Array(newsHeadlineSchema, { maxItems: 5 }),
});

export type NewsHeadline = Static<typeof newsHeadlineSchema>;
export type NewsPayload = Static<typeof newsPayloadSchema>;
export type NewsGroup = NewsPayload['group'];
