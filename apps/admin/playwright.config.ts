import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const ADMIN_PORT = process.env.ADMIN_E2E_PORT ?? '3001';
const baseURL = `http://127.0.0.1:${ADMIN_PORT}`;
const repoRoot = path.resolve(__dirname, '../..');
const adminDir = path.join(repoRoot, 'apps/admin');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `cd "${repoRoot}" && npx nx run admin:build && cd "${adminDir}" && PORT=${ADMIN_PORT} npx next start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
