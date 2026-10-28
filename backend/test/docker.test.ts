import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './helpers/repo.js';

const dockerAvailable = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const image = 'home-dashboard:verify';

function docker(args: string[], timeout = 600_000) {
  return spawnSync('docker', args, { encoding: 'utf8', timeout });
}

// Covers: FR-18, NFR-8, AC-29, AC-30, AC-33
// The test folder lives inside the repository because VM-based Docker setups (Colima, Docker
// Desktop) only share the home folder with the daemon, not the system temp directory.
// These tests need a running Docker daemon (Mac with Docker Desktop, or CI). Without one they
// are skipped and the acceptance criteria stay unverified - see the verification report.
describe.skipIf(!dockerAvailable)('container image', () => {
  it('builds for linux/amd64 and loads better-sqlite3 inside the image', () => {
    const build = docker([
      'build',
      '--platform',
      'linux/amd64',
      '-f',
      `${repoRoot}infrastructure/Dockerfile`,
      '--build-arg',
      'BUILD_ID=verify',
      '-t',
      image,
      repoRoot,
    ]);
    expect(build.status, build.stderr).toBe(0);

    const check = docker([
      'run',
      '--rm',
      '--platform',
      'linux/amd64',
      '--entrypoint',
      'node',
      image,
      '-e',
      "const D=require('better-sqlite3');new D(':memory:');console.log(process.arch)",
    ]);
    expect(check.status, check.stderr).toBe(0);
    expect(check.stdout.trim()).toBe('x64');
  }, 900_000);

  it('starts with the example configuration and answers /api/v1/health', async () => {
    const root = mkdtempSync(join(repoRoot, '.docker-test-'));
    try {
      for (const name of ['config', 'data', 'backup']) mkdirSync(join(root, name));
      cpSync(
        `${repoRoot}infrastructure/config.example/settings.example.yaml`,
        join(root, 'config', 'settings.yaml'),
      );
      writeFileSync(join(root, 'config', 'credentials.yaml'), '');
      const run = docker([
        'run',
        '-d',
        '--rm',
        '--platform',
        'linux/amd64',
        '--name',
        'home-dashboard-verify',
        '--read-only',
        '--tmpfs',
        '/tmp',
        '--cap-drop',
        'ALL',
        '--user',
        `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        '-p',
        '127.0.0.1:18080:8080',
        '-v',
        `${join(root, 'config')}:/config:ro`,
        '-v',
        `${join(root, 'data')}:/data`,
        '-v',
        `${join(root, 'backup')}:/backup`,
        image,
      ]);
      expect(run.status, run.stderr).toBe(0);
      let healthy = false;
      for (let attempt = 0; attempt < 30 && !healthy; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        healthy = await fetch('http://127.0.0.1:18080/api/v1/health')
          .then((r) => r.ok)
          .catch(() => false);
      }
      expect(healthy).toBe(true);
    } finally {
      docker(['rm', '-f', 'home-dashboard-verify']);
      rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);

  it('accepts the compose file', () => {
    const result = docker([
      'compose',
      '-f',
      `${repoRoot}infrastructure/docker-compose.yml`,
      'config',
      '--quiet',
    ]);
    expect(result.status, result.stderr).toBe(0);
  });
});
