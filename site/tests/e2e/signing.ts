import { randomBytes } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { type Db, openDb } from '../../src/lib/db';
import { mailQueue } from '../../src/lib/db/schema';
import { listSignatures } from '../../src/lib/signatures';
import { E2E_DATA_DIR, E2E_SITE_URL } from './env';
import { latestMailTo } from './mailpit';

export const CONSENT_LABEL =
  'I agree that my name, affiliation and country will be published on this site.';

/** A fresh address and name per test, so parallel tests never see each other's mail. */
export function uniqueSigner(prefix = 'signer') {
  const id = `${Date.now()}-${randomBytes(4).toString('hex')}`;
  return { name: `Test ${prefix} ${id}`, email: `${prefix}-${id}@example.org` };
}

export async function fillSignForm(
  page: Page,
  values: { name: string; email: string; affiliation?: string; country?: string },
) {
  await page.goto('/en/sign');
  await page.getByLabel('Name', { exact: true }).fill(values.name);
  if (values.affiliation) await page.getByLabel(/^Affiliation/).fill(values.affiliation);
  if (values.country) await page.getByLabel(/^Country/).selectOption(values.country);
  await page.getByLabel('Email address').fill(values.email);
  await page.getByLabel(CONSENT_LABEL).check();
}

/** Starts the ALTCHA proof of work and waits until the widget reports it verified. */
export async function solveAltcha(page: Page) {
  await page.locator('altcha-widget input[type="checkbox"]').click({ force: true });
  await expect(page.locator('altcha-widget [data-state="verified"]')).toHaveCount(1, {
    timeout: 15_000,
  });
}

export async function submitSignForm(page: Page) {
  await page.getByRole('button', { name: 'Sign the manifesto' }).click();
}

/** Waits for the confirmation mail and returns the link's path and query on our origin. */
export async function confirmPathFromMail(email: string, ignore: string[] = []) {
  const mail = await latestMailTo(email.toLowerCase(), { ignore });
  expect(mail.subject).toBe('Confirm your signature');
  const match = mail.text.match(/https:\/\/\S+\/en\/sign\/confirm\?token=[A-Za-z0-9_-]+/);
  expect(match, 'confirm link in the mail').not.toBeNull();
  const url = new URL(match?.[0] ?? '');
  expect(url.origin).toBe(E2E_SITE_URL);
  return { id: mail.id, path: `${url.pathname}${url.search}` };
}

/** Reads the e2e server's database directly (a second SQLite connection in WAL mode). */
export function withE2eDb<T>(fn: (db: Db) => T): T {
  const db = openDb(E2E_DATA_DIR);
  try {
    return fn(db);
  } finally {
    db.$client.close();
  }
}

export const publicSignatureNames = (query: string) =>
  withE2eDb((db) =>
    listSignatures(db, { query, page: 1, pageSize: 50 }).items.map((s) => s.displayName),
  );

export const queuedMailCount = (address: string) =>
  withE2eDb(
    (db) =>
      db
        .select()
        .from(mailQueue)
        .all()
        .filter((row) => row.to === address.toLowerCase()).length,
  );
