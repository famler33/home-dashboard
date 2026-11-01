import { gzipSync } from 'node:zlib';
import type Database from 'better-sqlite3';
import type { RadarDocument } from './types.js';

export interface RadarStore {
  save(doc: RadarDocument, now: number): void;
  load(): { version: string; bodyGzip: Buffer } | undefined;
}

export function createRadarStore(db: Database.Database): RadarStore {
  const upsert = db.prepare(
    `INSERT INTO radar_document (id, version, body_gzip, saved_at) VALUES (1, @version, @body, @now)
     ON CONFLICT(id) DO UPDATE SET version = excluded.version, body_gzip = excluded.body_gzip, saved_at = excluded.saved_at`,
  );
  const select = db.prepare('SELECT version, body_gzip FROM radar_document WHERE id = 1');

  return {
    save(doc, now) {
      upsert.run({ version: doc.version, body: gzipSync(JSON.stringify(doc), { level: 9 }), now });
    },
    load() {
      const row = select.get() as { version: string; body_gzip: Buffer } | undefined;
      return row ? { version: row.version, bodyGzip: row.body_gzip } : undefined;
    },
  };
}
