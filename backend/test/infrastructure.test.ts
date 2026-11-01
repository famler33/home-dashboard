import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { readRepoFile } from './helpers/repo.js';

interface Compose {
  services: { dashboard: Record<string, unknown> & { ports: string[]; volumes: string[] } };
}

const compose = parse(readRepoFile('infrastructure/docker-compose.yml')) as Compose;
const service = compose.services.dashboard;
const dockerfile = readRepoFile('infrastructure/Dockerfile');

// Covers: FR-18, FR-19, NFR-5, NFR-8, AC-14, AC-24, AC-30, AC-31, AC-32, AC-33, AC-34
describe('docker compose service', () => {
  it('declares restart: unless-stopped', () => {
    expect(service['restart']).toBe('unless-stopped');
  });

  it('publishes the port on DASHBOARD_BIND_IP only and never on 0.0.0.0', () => {
    expect(service.ports).toHaveLength(1);
    const mapping = service.ports[0] as string;
    expect(mapping).toMatch(/^\$\{DASHBOARD_BIND_IP:-127\.0\.0\.1\}:/);
    expect(mapping).not.toContain('0.0.0.0');
    expect(mapping).not.toMatch(/^\d+:\d+$/);
    expect(mapping).not.toMatch(/^"?\$\{DASHBOARD_PORT[^}]*\}:\d+"?$/);
  });

  it('does not use host networking, privileged mode or the docker socket', () => {
    expect(service['network_mode']).toBeUndefined();
    expect(service['privileged']).not.toBe(true);
    const text = readRepoFile('infrastructure/docker-compose.yml');
    expect(text).not.toContain('docker.sock');
    expect(text).not.toContain('network_mode');
    expect(service['pid']).toBeUndefined();
    expect(service['ipc']).toBeUndefined();
  });

  it('runs read-only, non-root, with all capabilities dropped', () => {
    expect(service['read_only']).toBe(true);
    expect(service['cap_drop']).toEqual(['ALL']);
    expect(service['security_opt']).toContain('no-new-privileges:true');
    expect(service['user']).toMatch(/^\$\{DASHBOARD_UID:-\d+\}:\$\{DASHBOARD_GID:-\d+\}$/);
    expect(service['user']).not.toMatch(/^(0|root)/);
    expect(service['tmpfs']).toEqual(['/tmp']);
  });

  it('keeps /data outside the container filesystem as a persistent bind mount', () => {
    expect(service.volumes).toContain('./data:/data');
  });

  it('mounts the configuration read-only and the backup folder writable', () => {
    expect(service.volumes).toContain('./config:/config:ro');
    expect(service.volumes).toContain('./backup:/backup');
  });

  it('pins platform linux/amd64', () => {
    expect(service['platform']).toBe('linux/amd64');
  });

  it('defines a node-based healthcheck against /api/v1/health', () => {
    const health = service['healthcheck'] as {
      test: string[];
      interval: string;
      timeout: string;
      retries: number;
      start_period: string;
    };
    expect(health.test.join(' ')).toContain('/api/v1/health');
    expect(health.test[1]).toBe('node');
    expect(health.interval).toBe('30s');
    expect(health.timeout).toBe('5s');
    expect(health.retries).toBe(3);
    expect(health.start_period).toBe('20s');
  });

  it('caps the container log size', () => {
    expect(service['logging']).toEqual({
      driver: 'json-file',
      options: { 'max-size': '10m', 'max-file': '3' },
    });
  });

  it('passes the build id to the image build and the container', () => {
    const build = service['build'] as { args: Record<string, string> };
    expect(build.args['BUILD_ID']).toContain('BUILD_ID');
    expect((service['environment'] as Record<string, string>)['BUILD_ID']).toContain('BUILD_ID');
  });
});

// Covers: NFR-5, NFR-8, AC-27, AC-33
describe('Dockerfile', () => {
  it('builds on a pinned Debian slim Node image (glibc) for linux/amd64', () => {
    expect(dockerfile).toMatch(
      /FROM --platform=linux\/amd64 node:\$\{NODE_VERSION\}-bookworm-slim/,
    );
    expect(dockerfile).toMatch(/ARG NODE_VERSION=\d+\.\d+\.\d+/);
    expect(dockerfile).not.toMatch(/alpine/i);
  });

  it('runs as a numeric non-root user', () => {
    expect(dockerfile).toMatch(/^USER \d+:\d+$/m);
    expect(dockerfile).not.toMatch(/^USER (root|0)/m);
  });

  it('does not copy configuration, credentials or deploy settings into the image', () => {
    const copies = dockerfile.split('\n').filter((line) => /^\s*(COPY|ADD)\b/.test(line));
    for (const line of copies) {
      expect(line).not.toMatch(/credentials|settings\.yaml|\bconfig\b|deploy\.env|\.env\b/);
    }
  });

  it('bakes the build id into the image and the SPA build', () => {
    expect(dockerfile).toContain('ARG BUILD_ID');
    expect(dockerfile).toMatch(/ENV BUILD_ID=\$\{?BUILD_ID\}?/);
    expect(dockerfile).toMatch(/BUILD_ID=\$\{?BUILD_ID\}? pnpm exec vite build/);
  });

  it('serves the built SPA from the backend and starts the compiled server', () => {
    expect(dockerfile).toContain('STATIC_DIR=/app/static');
    expect(dockerfile).toMatch(/CMD \["node", "dist\/main\.js"\]/);
    expect(dockerfile).toContain('NODE_ENV=production');
  });
});
