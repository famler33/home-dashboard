import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

interface Migration {
  version: number;
  sql: string;
}

function loadMigrations(dir: string): Migration[] {
  return readdirSync(dir)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .map((name) => ({
      version: Number.parseInt(name.slice(0, name.indexOf('_')), 10),
      sql: readFileSync(join(dir, name), 'utf8'),
    }))
    .sort((a, b) => a.version - b.version);
}

export function runMigrations(db: Database.Database, dir: string): void {
  const migrations = loadMigrations(dir);
  const latest = migrations.at(-1)?.version ?? 0;
  const current = Number(db.pragma('user_version', { simple: true }));

  if (current > latest) {
    throw new Error(
      `DB_SCHEMA_NEWER_THAN_APP: database schema version ${current} is newer than this application (${latest})`,
    );
  }

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
}
