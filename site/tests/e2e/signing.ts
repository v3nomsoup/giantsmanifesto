import { randomBytes } from 'node:crypto';
import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { and, eq } from 'drizzle-orm';
import { type Db, openDb } from '../../src/lib/db';
import { emailTokens, mailQueue, signatures } from '../../src/lib/db/schema';
import { hashEmail } from '../../src/lib/email';
import { COOLDOWN_MS } from '../../src/lib/mail/request';
import { countSignatures, createEmailSignature, findByEmailHash } from '../../src/lib/signatures';
import { createToken, type TokenPurpose } from '../../src/lib/tokens';
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

/** Names in the public list for a search, read from the real `/en/signatures` page. */
export async function listedNames(request: APIRequestContext, query: string): Promise<string[]> {
  const response = await request.get(`/en/signatures?q=${encodeURIComponent(query)}`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  return [...html.matchAll(/<strong class="signature-name">([^<]*)<\/strong>/g)].map(
    (match) => match[1] ?? '',
  );
}

/** Seeds a signature and a valid withdraw link directly, for tests that only need the page. */
export function seedWithdrawLink({ withSignature = true } = {}): string {
  const signer = uniqueSigner('seed');
  return withE2eDb((db) => {
    const emailHash = hashEmail(signer.email);
    if (withSignature) {
      createEmailSignature(db, {
        displayName: signer.name,
        affiliation: 'Analytical Engines',
        country: 'GB',
        emailHash,
        manifestoVersion: '1',
        consentAt: Date.now(),
      });
    }
    return `/en/withdraw/confirm?token=${createToken(db, 'withdraw', { emailHash })}`;
  });
}

export const findSignature = (email: string) =>
  withE2eDb((db) => findByEmailHash(db, hashEmail(email)));

/** Signs through the form and the mail link, so the address ends up in the list. */
export async function signAndConfirm(page: Page, signer: { name: string; email: string }) {
  await fillSignForm(page, signer);
  await solveAltcha(page);
  await submitSignForm(page);
  await expect(page).toHaveURL(/\/en\/sign\/check-email$/);
  const mail = await confirmPathFromMail(signer.email);
  await page.goto(mail.path);
  await page.getByRole('button', { name: 'Confirm signature' }).click();
  await expect(page).toHaveURL(/\/en\/sign\/thanks$/);
  return mail.id;
}

export async function fillWithdrawForm(page: Page, email: string) {
  await page.goto('/en/withdraw');
  await page.getByLabel('Email address').fill(email);
}

export async function submitWithdrawForm(page: Page) {
  await page.getByRole('button', { name: 'Send me a link' }).click();
}

/** Waits for the withdraw mail and returns the link's path and query on our origin. */
export async function withdrawPathFromMail(email: string, ignore: string[] = []) {
  const mail = await latestMailTo(email.toLowerCase(), { ignore });
  expect(mail.subject).toBe('Withdraw your signature');
  const match = mail.text.match(/https:\/\/\S+\/en\/withdraw\/confirm\?token=[A-Za-z0-9_-]+/);
  expect(match, 'withdraw link in the mail').not.toBeNull();
  const url = new URL(match?.[0] ?? '');
  expect(url.origin).toBe(E2E_SITE_URL);
  return { id: mail.id, path: `${url.pathname}${url.search}` };
}

export const queuedMailCount = (address: string) =>
  withE2eDb(
    (db) =>
      db
        .select()
        .from(mailQueue)
        .all()
        .filter((row) => row.to === address.toLowerCase()).length,
  );

export const signatureCount = () => withE2eDb((db) => countSignatures(db));

export interface SeedSignature {
  displayName: string;
  affiliation?: string;
  country?: string;
  createdAt?: number;
  hidden?: boolean;
}

/** Inserts signatures directly, for tests that only need the public pages to show them. */
export function seedSignatures(rows: SeedSignature[]): number[] {
  return withE2eDb((db) =>
    rows.map((row) => {
      const { id } = db
        .insert(signatures)
        .values({
          createdAt: row.createdAt ?? Date.now(),
          displayName: row.displayName,
          affiliation: row.affiliation ?? '',
          country: row.country ?? '',
          provider: 'email',
          providerSubject: hashEmail(`seed-${randomBytes(8).toString('hex')}@example.org`),
          manifestoVersion: '1',
          consentAt: Date.now(),
          hidden: row.hidden ?? false,
        })
        .returning({ id: signatures.id })
        .get();
      return id;
    }),
  );
}

/**
 * Moves this address's tokens of `purpose` back past the 15-minute cooldown, so the next
 * request sends mail again. Expiry is a separate column and stays as it is.
 */
export const endCooldown = (email: string, purpose: TokenPurpose) =>
  withE2eDb((db) => {
    const where = and(
      eq(emailTokens.purpose, purpose),
      eq(emailTokens.emailHash, hashEmail(email)),
    );
    for (const row of db.select().from(emailTokens).where(where).all()) {
      db.update(emailTokens)
        .set({ createdAt: row.createdAt - COOLDOWN_MS - 60_000 })
        .where(eq(emailTokens.id, row.id))
        .run();
    }
  });
