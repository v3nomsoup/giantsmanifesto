import { defineConfig, devices } from '@playwright/test';
import { E2E_DATA_DIR, E2E_SITE_URL } from './tests/e2e/env';

const port = 4322;

/**
 * Signing enabled, mail to Mailpit on 127.0.0.1:1025. `npm run build` runs inside the command,
 * so SITE_URL also sets the build-time `security.allowedDomains` (as in production).
 */
const signingEnv = {
  SITE_URL: E2E_SITE_URL,
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  MAIL_FROM: 'contact@giantsmanifesto.org',
  SESSION_SECRET: 'test-secret',
  ALTCHA_MAX_NUMBER: '1000',
  RATE_LIMIT_MAX: '1000',
  DATA_DIR: E2E_DATA_DIR,
};

export default defineConfig({
  testDir: 'tests/e2e',
  // Runs after the web servers have started (Playwright starts them first), so it must not
  // touch their data directory; that is removed by the web server command before it starts.
  globalSetup: './tests/e2e/global-setup.ts',
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `rm -rf "${E2E_DATA_DIR}" && npm run build && HOST=127.0.0.1 PORT=${port} node dist/server/entry.mjs`,
      env: signingEnv,
      url: `http://127.0.0.1:${port}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
