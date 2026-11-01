import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

export function readRepoFile(path: string): string {
  return readFileSync(`${repoRoot}${path}`, 'utf8');
}
