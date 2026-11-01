import type Database from 'better-sqlite3';

export type SourceErrorCode = 'SOURCE_FETCH_FAILED' | 'SOURCE_TIMEOUT';

export interface SourceState {
  sourceId: string;
  payload: unknown | null;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  lastErrorCode: SourceErrorCode | null;
  consecutiveFailures: number;
}

export interface SnapshotStore {
  recordSuccess(sourceId: string, payload: unknown, now: number): void;
  recordFailure(sourceId: string, code: SourceErrorCode, now: number): void;
  get(sourceId: string): SourceState | undefined;
  ping(): boolean;
}

interface Row {
  source_id: string;
  payload_json: string | null;
  last_success_at: number | null;
  last_attempt_at: number | null;
  last_error_code: SourceErrorCode | null;
  consecutive_failures: number;
}

export function createSnapshotStore(db: Database.Database): SnapshotStore {
  const upsertSuccess = db.prepare(
    `INSERT INTO source_state
       (source_id, payload_json, last_success_at, last_attempt_at, last_error_code, consecutive_failures)
     VALUES (@id, @payload, @now, @now, NULL, 0)
     ON CONFLICT(source_id) DO UPDATE SET
       payload_json = excluded.payload_json,
       last_success_at = excluded.last_success_at,
       last_attempt_at = excluded.last_attempt_at,
       last_error_code = NULL,
       consecutive_failures = 0`,
  );
  const upsertFailure = db.prepare(
    `INSERT INTO source_state
       (source_id, payload_json, last_success_at, last_attempt_at, last_error_code, consecutive_failures)
     VALUES (@id, NULL, NULL, @now, @code, 1)
     ON CONFLICT(source_id) DO UPDATE SET
       last_attempt_at = excluded.last_attempt_at,
       last_error_code = excluded.last_error_code,
       consecutive_failures = source_state.consecutive_failures + 1`,
  );
  const select = db.prepare('SELECT * FROM source_state WHERE source_id = ?');
  const ping = db.prepare('SELECT 1 AS ok');

  return {
    recordSuccess(sourceId, payload, now) {
      const json = JSON.stringify(payload);
      if (json === undefined) throw new Error('payload is not JSON serialisable');
      upsertSuccess.run({ id: sourceId, payload: json, now });
    },
    recordFailure(sourceId, code, now) {
      upsertFailure.run({ id: sourceId, code, now });
    },
    get(sourceId) {
      const row = select.get(sourceId) as Row | undefined;
      if (!row) return undefined;
      return {
        sourceId: row.source_id,
        payload: row.payload_json === null ? null : (JSON.parse(row.payload_json) as unknown),
        lastSuccessAt: row.last_success_at,
        lastAttemptAt: row.last_attempt_at,
        lastErrorCode: row.last_error_code,
        consecutiveFailures: row.consecutive_failures,
      };
    },
    ping() {
      try {
        return (ping.get() as { ok: number }).ok === 1;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Removes the stored state of every source whose id starts with `prefix` from a database
 * (used on backup copies, so no history of licensed content accumulates) and compacts the
 * file so the deleted payloads do not linger in free pages.
 */
export function purgeSourceState(db: Database.Database, prefix: string): void {
  db.prepare("DELETE FROM source_state WHERE source_id LIKE ? ESCAPE '\\'").run(
    `${prefix.replace(/[\\%_]/g, '\\$&')}%`,
  );
  db.exec('VACUUM');
}
