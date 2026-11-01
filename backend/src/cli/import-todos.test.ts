import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSnapshotStore } from '../cache/snapshot-store.js';
import { migrationsDir } from '../db/database.js';
import { runMigrations } from '../db/migrate.js';
import { createListsService, type ListsService } from '../lists/lists-service.js';
import { runImport } from './import-todos.js';

const sample = readFileSync(
  new URL('../../test/fixtures/lists/old-todos.sample.json', import.meta.url),
  'utf8',
);

let dataDir: string;
let db: Database.Database;
let service: ListsService;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'dashboard-import-'));
  mkdirSync(join(dataDir, 'imports'));
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, migrationsDir);
  service = createListsService({
    db,
    store: createSnapshotStore(db),
    now: () => Date.parse('2026-10-28T10:00:00Z'),
    timezone: 'Europe/Berlin',
  });
});
afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

const put = (name: string, content: string) => {
  const file = join(dataDir, 'imports', name);
  writeFileSync(file, content);
  return file;
};
const run = (file: string, extra: { dryRun?: boolean; deleteFile?: boolean } = {}) =>
  runImport({
    file,
    dataDir,
    db,
    timezone: 'Europe/Berlin',
    now: () => Date.parse('2026-10-28T10:00:00Z'),
    ...extra,
  });

// Covers: FR-10, NFR-3, NFR-7, NFR-8, AC-46, AC-47, AC-48, AC-49, AC-50
describe('import of the old open tasks', () => {
  it('imports title, category, priority, effort and prerequisite of open tasks', () => {
    const result = run(put('todos.json', sample));
    expect(result.exitCode).toBe(0);
    const todos = service.state().todos;
    expect(todos).toHaveLength(6);
    const lights = todos.find((todo) => todo.title === 'Lichtsituation planen')!;
    expect(lights).toMatchObject({
      categoryId: 'wohnzimmer',
      priority: 'high',
      effortHours: 2,
      prerequisite: 'Lampen planen & kaufen',
    });
    expect(todos.find((todo) => todo.title === 'Pflanze leiten')).toMatchObject({
      priority: 'low',
      effortHours: 0.5,
    });
  });

  it('skips tasks that are done', () => {
    run(put('todos.json', sample));
    expect(service.state().todos.some((todo) => todo.title === 'Schuhe aussortieren')).toBe(false);
  });

  it('creates missing categories and does not add a task twice when run again', () => {
    const first = run(put('todos.json', sample));
    expect(service.state().categories.some((category) => category.name === 'Keller')).toBe(true);
    expect(first.output.join('\n')).toMatch(/categories created: 1/);
    const second = run(put('again.json', sample));
    expect(second.exitCode).toBe(0);
    expect(service.state().todos).toHaveLength(6);
    expect(second.output.join('\n')).toMatch(/imported: 0/);
  });

  it('changes nothing and says so for invalid JSON, a wrong schema, a symlink or a file over 1 MiB', () => {
    const cases: [string, () => string][] = [
      ['invalid JSON', () => put('bad.json', '{ nope')],
      ['wrong schema', () => put('schema.json', JSON.stringify({ version: 2, tasks: [] }))],
      [
        'unknown priority',
        () =>
          put(
            'prio.json',
            JSON.stringify({
              version: 1,
              tasks: [{ title: 'A', category: 'Büro', priority: 'Dringend' }],
            }),
          ),
      ],
      [
        'too large',
        () =>
          put(
            'big.json',
            JSON.stringify({ version: 1, tasks: [], pad: 'x'.repeat(1024 * 1024 + 1) }),
          ),
      ],
      [
        'symlink',
        () => {
          put('real.json', sample);
          const link = join(dataDir, 'imports', 'link.json');
          symlinkSync(join(dataDir, 'imports', 'real.json'), link);
          return link;
        },
      ],
      [
        'outside the import folder',
        () => {
          const file = join(dataDir, 'todos.json');
          writeFileSync(file, sample);
          return file;
        },
      ],
      ['missing file', () => join(dataDir, 'imports', 'missing.json')],
    ];
    for (const [name, makeFile] of cases) {
      const result = run(makeFile());
      expect(result.exitCode, name).toBe(1);
      expect(result.output.join('\n'), name).not.toContain('Verkabelung');
      expect(service.state().todos, name).toHaveLength(0);
    }
  });

  it('rolls everything back when one task is invalid', () => {
    const tasks = [
      { title: 'Gut', category: 'Büro', priority: 'Hoch' },
      { title: 'x'.repeat(81), category: 'Büro', priority: 'Hoch' },
    ];
    const result = run(put('mixed.json', JSON.stringify({ version: 1, tasks })));
    expect(result.exitCode).toBe(1);
    expect(service.state().todos).toHaveLength(0);
    expect(service.state().categories).toHaveLength(10);
  });

  it('needs only the file: no network and no running old app', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('network used');
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(run(put('todos.json', sample)).exitCode).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('writes nothing with --dry-run and prints counts only', () => {
    const result = run(put('todos.json', sample), { dryRun: true });
    expect(result.exitCode).toBe(0);
    expect(service.state().todos).toHaveLength(0);
    expect(result.output.join('\n')).toMatch(/imported: 6/);
    expect(result.output.join('\n')).toMatch(/dry run/i);
    for (const line of result.output) {
      expect(line).not.toMatch(/Verkabelung|Lichtsituation|Büro/);
    }
  });

  it('respects the caps of the lists', () => {
    const tasks = Array.from({ length: 501 }, (_, index) => ({
      title: `Aufgabe ${index}`,
      category: 'Büro',
      priority: 'Mittel',
    }));
    const result = run(put('many.json', JSON.stringify({ version: 1, tasks })));
    expect(result.exitCode).toBe(1);
    expect(service.state().todos).toHaveLength(0);
  });

  it('removes the export file only after a successful real import when asked', () => {
    const kept = put('keep.json', sample);
    run(kept, { dryRun: true, deleteFile: true });
    expect(existsSync(kept)).toBe(true);
    const gone = put('gone.json', sample);
    run(gone, { deleteFile: true });
    expect(existsSync(gone)).toBe(false);
    const failed = put('failed.json', '{ nope');
    run(failed, { deleteFile: true });
    expect(existsSync(failed)).toBe(true);
  });
});
