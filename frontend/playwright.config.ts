import { defineConfig } from '@playwright/test';

const soak = process.env['SOAK'] === '1';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  grep: soak ? /@soak/ : undefined,
  grepInvert: soak ? undefined : /@soak/,
  timeout: soak ? 3_600_000 : 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1920, height: 1200 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // The production build is served by the real backend, so security headers are exercised.
    command: [
      'BUILD_ID=e2e pnpm exec vite build',
      'mkdir -p e2e/.data e2e/.backup',
      'CONFIG_DIR="$PWD/e2e/fixtures/config" DATA_DIR="$PWD/e2e/.data" BACKUP_DIR="$PWD/e2e/.backup" STATIC_DIR="$PWD/dist" BUILD_ID=e2e HOST=127.0.0.1 PORT=4173 pnpm --dir ../backend exec tsx src/main.ts',
    ].join(' && '),
    url: 'http://127.0.0.1:4173/api/v1/health',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
