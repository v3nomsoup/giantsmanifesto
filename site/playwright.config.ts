import { defineConfig, devices } from '@playwright/test';

const port = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && HOST=127.0.0.1 PORT=${port} node dist/server/entry.mjs`,
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
