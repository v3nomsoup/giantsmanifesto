import { fileURLToPath } from 'node:url';

/** Data directory of the e2e web server; removed before every run (see playwright.config.ts). */
export const E2E_DATA_DIR = fileURLToPath(new URL('../../.e2e-data', import.meta.url));

/** Data directory of the second web server, where signing is paused. */
export const E2E_PAUSED_DATA_DIR = `${E2E_DATA_DIR}-paused`;

/** The production origin. Links in mail point here; tests open their path on the local server. */
export const E2E_SITE_URL = 'https://giantsmanifesto.org';

export const MAILPIT_API = 'http://127.0.0.1:8025/api/v1';
