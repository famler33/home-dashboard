import { randomUUID } from 'node:crypto';
import { lstatSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import type Database from 'better-sqlite3';
import { createSnapshotStore } from '../cache/snapshot-store.js';
import { loadConfig } from '../config/load-config.js';
import { openDatabase } from '../db/database.js';
import { createListsService, ListsError } from '../lists/lists-service.js';
import { keyOf, sanitiseText } from '../lists/lists-text.js';
import type { Priority } from '../lists/lists-types.js';

const MAX_BYTES = 1024 * 1024;
const priorities: Record<string, Priority> = { Hoch: 'high', Mittel: 'medium', Niedrig: 'low' };

const importSchema = Type.Object(
  {
    version: Type.Literal(1),
    tasks: Type.Array(
      Type.Object(
        {
          title: Type.String(),
          category: Type.String(),
          priority: Type.Union([
            Type.Literal('Hoch'),
            Type.Literal('Mittel'),
            Type.Literal('Niedrig'),
          ]),
          effortHours: Type.Optional(Type.Number()),
          prerequisite: Type.Optional(Type.String()),
          done: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export interface ImportOptions {
  file: string;
  dataDir: string;
  db: Database.Database;
  timezone: string;
  now: () => number;
  dryRun?: boolean;
  deleteFile?: boolean;
}

export interface ImportResult {
  exitCode: 0 | 1;
  output: string[];
}

class DryRun extends Error {}

const failure = (reason: string): ImportResult => ({
  exitCode: 1,
  output: [`import failed: ${reason}`],
});

/**
 * One-time import of the open tasks of the old to-do app from a JSON file in `data/imports/`.
 * All or nothing; prints counts only, never titles or paths.
 */
export function runImport(options: ImportOptions): ImportResult {
  const importsDir = resolve(options.dataDir, 'imports');
  const file = resolve(options.file);
  if (dirname(file) !== importsDir) return failure('the file must be inside the imports folder');
  let size: number;
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return failure('the file is not a regular file');
    size = stat.size;
  } catch {
    return failure('the file could not be read');
  }
  if (size > MAX_BYTES) return failure('the file is larger than 1 MiB');

  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return failure('the file is not valid JSON');
  }
  if (!Value.Check(importSchema, data)) return failure('the file does not match the import format');

  const service = createListsService({
    db: options.db,
    store: createSnapshotStore(options.db),
    now: options.now,
    timezone: options.timezone,
  });
  const counts = { read: data.tasks.length, imported: 0, skipped: 0, categories: 0 };

  try {
    options.db.transaction(() => {
      for (const task of data.tasks) {
        if (task.done === true) {
          counts.skipped += 1;
          continue;
        }
        const name = sanitiseText(task.category, 20);
        const title = sanitiseText(task.title, 80);
        if (name === null || title === null) throw new ListsError('VALIDATION_FAILED');

        let category = options.db
          .prepare('SELECT id FROM categories WHERE name_key = ? AND deleted_at IS NULL')
          .get(keyOf(name)) as { id: string } | undefined;
        if (!category) {
          const id = randomUUID();
          service.addCategory({ id, name });
          category = { id };
          counts.categories += 1;
        }
        const duplicate = options.db
          .prepare(
            "SELECT 1 FROM list_items WHERE list = 'todo' AND deleted_at IS NULL AND title_key = ? AND category_id = ?",
          )
          .get(keyOf(title), category.id);
        if (duplicate) {
          counts.skipped += 1;
          continue;
        }
        service.addItem({
          id: randomUUID(),
          list: 'todo',
          title,
          categoryId: category.id,
          priority: priorities[task.priority] ?? 'medium',
          effortHours: task.effortHours ?? null,
          prerequisite: task.prerequisite ?? null,
        });
        counts.imported += 1;
      }
      if (options.dryRun) throw new DryRun();
    })();
  } catch (error) {
    if (error instanceof DryRun) {
      return { exitCode: 0, output: summary(counts, true) };
    }
    if (error instanceof ListsError) return failure(`a task was rejected (${error.code})`);
    return failure('unexpected error');
  }

  if (options.deleteFile) rmSync(file, { force: true });
  return { exitCode: 0, output: summary(counts, false) };
}

function summary(
  counts: { read: number; imported: number; skipped: number; categories: number },
  dryRun: boolean,
): string[] {
  return [
    `read: ${counts.read}`,
    `imported: ${counts.imported}`,
    `skipped: ${counts.skipped}`,
    `categories created: ${counts.categories}`,
    ...(dryRun ? ['dry run: nothing was written'] : []),
  ];
}

function main(argv: string[], env: NodeJS.ProcessEnv): number {
  const args = argv.filter((arg) => !arg.startsWith('--'));
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const file = args[0];
  if (!file || [...flags].some((flag) => !['--dry-run', '--delete-file'].includes(flag))) {
    console.error('usage: import-todos.js <file in data/imports> [--dry-run] [--delete-file]');
    return 2;
  }
  const dataDir = env['DATA_DIR'] ?? '/data';
  const config = loadConfig(env);
  const db = openDatabase(join(dataDir, 'dashboard.sqlite'));
  try {
    const result = runImport({
      file,
      dataDir,
      db,
      timezone: config.settings.timezone,
      now: () => Date.now(),
      dryRun: flags.has('--dry-run'),
      deleteFile: flags.has('--delete-file'),
    });
    for (const line of result.output) console.log(line);
    return result.exitCode;
  } finally {
    db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2), process.env));
}
