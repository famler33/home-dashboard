import { Type, type Static } from '@sinclair/typebox';

export const sourceSnapshotSchema = Type.Object({
  id: Type.String(),
  status: Type.Union([
    Type.Literal('never-loaded'),
    Type.Literal('fresh'),
    Type.Literal('stale'),
    Type.Literal('error'),
  ]),
  data: Type.Unknown(),
  lastUpdated: Type.Union([Type.String(), Type.Null()]),
  ageSeconds: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
  staleAfterSeconds: Type.Integer({ minimum: 1 }),
  lastErrorCode: Type.Union([
    Type.Literal('SOURCE_FETCH_FAILED'),
    Type.Literal('SOURCE_TIMEOUT'),
    Type.Null(),
  ]),
});

export const snapshotSchema = Type.Object({
  buildId: Type.String(),
  serverTime: Type.String(),
  settings: Type.Object({
    timezone: Type.String(),
    display: Type.Object({
      nightFrom: Type.String(),
      nightTo: Type.String(),
      dailyReloadAt: Type.String(),
    }),
  }),
  sources: Type.Array(sourceSnapshotSchema),
});

export type Snapshot = Static<typeof snapshotSchema>;
export type SourceSnapshot = Static<typeof sourceSnapshotSchema>;
