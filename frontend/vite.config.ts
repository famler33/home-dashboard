import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const buildId = process.env['BUILD_ID'] ?? 'dev';

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  server: { proxy: { '/api': 'http://localhost:8080' } },
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
