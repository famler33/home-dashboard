import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/load-config.js';
import { readRepoFile, repoRoot } from './helpers/repo.js';

const runbook = readRepoFile('infrastructure/README.md');
const deploy = readRepoFile('scripts/deploy.sh');

function dryRun(args: string[] = []): string {
  const result = spawnSync('bash', [`${repoRoot}scripts/deploy.sh`, ...args], {
    env: {
      ...process.env,
      DRY_RUN: '1',
      DEPLOY_ENV_FILE: `${repoRoot}scripts/deploy.env.example`,
    },
    encoding: 'utf8',
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

// Covers: FR-17, NFR-5, NFR-7, AC-27, AC-28
describe('repository hygiene', () => {
  it('git-ignores and docker-ignores credentials, deploy settings and runtime folders', () => {
    for (const file of ['.gitignore', '.dockerignore']) {
      const text = readRepoFile(file);
      expect(text, file).toContain('credentials.yaml');
      expect(text, file).toContain('scripts/deploy.env');
      expect(text, file).toContain('infrastructure/config');
      expect(text, file).toContain('infrastructure/data');
      expect(text, file).toContain('infrastructure/backup');
      expect(text, file).toMatch(/^\.env$/m);
    }
  });

  it('loads settings.example.yaml and credentials.example.yaml with the real schema', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dashboard-example-'));
    try {
      cpSync(
        `${repoRoot}infrastructure/config.example/settings.example.yaml`,
        join(dir, 'settings.yaml'),
      );
      cpSync(
        `${repoRoot}infrastructure/config.example/credentials.example.yaml`,
        join(dir, 'credentials.yaml'),
      );
      const config = loadConfig({ CONFIG_DIR: dir });
      expect(config.settings.timezone).toBe('Europe/Berlin');
      expect(config.settings.backup.retention).toBe(14);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('uses obvious placeholders in credentials.example.yaml', () => {
    const text = readRepoFile('infrastructure/config.example/credentials.example.yaml');
    expect(text).toContain('CHANGE_ME');
    expect(text).not.toMatch(/^\s*[a-z-]+:\s*\n\s+\w+:\s*(?!CHANGE_ME)\S+/m);
  });

  it('documents every setting with a comment', () => {
    const lines = readRepoFile('infrastructure/config.example/settings.example.yaml').split('\n');
    lines.forEach((line, index) => {
      if (!/^\s*[A-Za-z]+:/.test(line)) return;
      const previous = lines
        .slice(0, index)
        .reverse()
        .find((candidate) => candidate.trim() !== '');
      const documented = line.includes('#') || (previous?.trim().startsWith('#') ?? false);
      expect(documented, `line ${index + 1}: ${line}`).toBe(true);
    });
  });

  it('ships a compose example file with placeholders only', () => {
    const text = readRepoFile('infrastructure/.env.example');
    for (const key of ['DASHBOARD_BIND_IP', 'DASHBOARD_PORT', 'DASHBOARD_UID', 'DASHBOARD_GID']) {
      expect(text).toContain(`${key}=`);
    }
    expect(text).not.toMatch(/KEY|TOKEN|PASSWORD|SECRET/i);
  });
});

// Covers: FR-16, FR-18, FR-19, FR-22, NFR-7, AC-29, AC-31, AC-39, AC-43
describe('runbook', () => {
  it('documents first install, update, rollback, restore and troubleshooting', () => {
    for (const heading of [
      /^## .*Erstinstallation/im,
      /^## .*Update/im,
      /^## .*Rollback/im,
      /^## .*Backup.*Wiederherstellung/im,
      /^## .*Fehlersuche/im,
    ]) {
      expect(runbook).toMatch(heading);
    }
  });

  it('documents tablet kiosk settings and the wake lock limitation', () => {
    expect(runbook).toMatch(/^## .*Tablet/im);
    for (const keyword of [
      'Auto-Sperre',
      'Geführter Zugriff',
      'Home-Bildschirm',
      'Wake Lock',
      'HTTP',
    ]) {
      expect(runbook, keyword).toContain(keyword);
    }
  });

  it('documents hostname, DHCP reservation, guest network assumption and the phone edit risk', () => {
    for (const keyword of ['DHCP-Reservierung', 'dashboard.home', 'Gäste', 'ohne Login']) {
      expect(runbook, keyword).toContain(keyword);
    }
  });

  it('documents Container Manager start on boot and the network protection', () => {
    for (const keyword of [
      'Container Manager',
      'Port-Weiterleitung',
      'UPnP',
      'Firewall',
      'QuickConnect',
    ]) {
      expect(runbook, keyword).toContain(keyword);
    }
  });

  it('documents the restore of a backup and the NAS user for deployments', () => {
    expect(runbook).toContain('dashboard-');
    expect(runbook).toContain('.sqlite');
    expect(runbook).toMatch(/ed25519/);
    expect(runbook).toContain('known_hosts');
  });
});

// Covers: FR-24, NFR-5, NFR-7, AC-30, AC-42
describe('deploy script', () => {
  it('has valid bash syntax', () => {
    const result = spawnSync('bash', ['-n', `${repoRoot}scripts/deploy.sh`], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });

  it('prints the build, save, ssh, load and compose up steps in dry-run mode', () => {
    const output = dryRun();
    expect(output).toContain('docker build --platform linux/amd64');
    expect(output).toContain('docker save');
    expect(output).toContain('docker load');
    expect(output).toContain('docker compose');
    expect(output).toContain('up -d');
    expect(output).toContain('ssh');
  });

  it('uses strict host key checking, a dedicated key and no password login', () => {
    expect(deploy).toContain('StrictHostKeyChecking=yes');
    expect(deploy).toContain('IdentitiesOnly=yes');
    expect(deploy).toContain('PasswordAuthentication=no');
    expect(deploy).toContain('BatchMode=yes');
    expect(deploy).not.toMatch(/StrictHostKeyChecking=(no|accept-new)/);
    expect(deploy).not.toMatch(/set -[a-z]*x/);
  });

  it('never transfers configuration or credentials, only the image and the compose file', () => {
    const output = dryRun();
    expect(output).not.toMatch(/credentials/i);
    expect(output).not.toMatch(/settings\.yaml/);
    expect(output).not.toMatch(/config\.example/);
    expect(output).toContain('docker-compose.yml');
  });

  it('never deletes data, backup or configuration directories', () => {
    expect(deploy).not.toMatch(/rm -rf?\s+[^\n]*(data|backup|config)/);
    expect(deploy).not.toMatch(/rsync[^\n]*--delete/);
    expect(dryRun()).not.toMatch(/rm -rf/);
  });

  it('keeps the previous image tag and supports --rollback', () => {
    const deployOutput = dryRun();
    expect(deployOutput).toContain('.previous-build');
    const rollbackOutput = dryRun(['--rollback']);
    expect(rollbackOutput).toContain('.previous-build');
    expect(rollbackOutput).toContain('up -d');
    expect(rollbackOutput).not.toContain('docker build');
  });

  it('prunes old image tags but keeps the configured number', () => {
    expect(dryRun()).toMatch(/docker rmi|xargs/);
    expect(deploy).toContain('KEEP_TAGS');
  });

  it('refuses to run without its settings file', () => {
    const result = spawnSync('bash', [`${repoRoot}scripts/deploy.sh`], {
      env: { ...process.env, DRY_RUN: '1', DEPLOY_ENV_FILE: '/nonexistent/deploy.env' },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('deploy.env');
  });
});
