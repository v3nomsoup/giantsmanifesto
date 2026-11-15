import { expect, test } from '@playwright/test';
import { mailIdsTo } from './mailpit';
import {
  fillWithdrawForm,
  findSignature,
  publicSignatureNames,
  queuedMailCount,
  seedWithdrawLink,
  signAndConfirm,
  solveAltcha,
  submitWithdrawForm,
  uniqueSigner,
  withdrawPathFromMail,
} from './signing';

test('withdrawing: mail link shows the signature, GET keeps it, POST deletes it, link is then used', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const signer = uniqueSigner('withdraw');
  const signMailId = await signAndConfirm(page, signer);
  expect(publicSignatureNames(signer.name)).toEqual([signer.name]);

  // The address in different case and with spaces still finds the signature.
  await fillWithdrawForm(page, `  ${signer.email.toUpperCase()} `);
  await solveAltcha(page);
  await submitWithdrawForm(page);
  await expect(page).toHaveURL(/\/en\/withdraw\/check-email$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check your email');
  await expect(
    page.getByText('If a signature exists for this address, we sent a link to withdraw it.'),
  ).toBeVisible();

  const link = await withdrawPathFromMail(signer.email, [signMailId]);

  // Opening the link (as a mail scanner would) shows the signature but deletes nothing.
  await page.goto(link.path);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  await expect(page.locator('main').getByText(signer.name)).toBeVisible();
  await page.reload();
  expect(publicSignatureNames(signer.name)).toEqual([signer.name]);

  const secondTab = await context.newPage();
  await secondTab.goto(link.path);

  await page.getByRole('button', { name: 'Delete my signature' }).click();
  await expect(page).toHaveURL(/\/en\/withdraw\/done$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your signature is deleted');
  expect(publicSignatureNames(signer.name)).toEqual([]);
  expect(findSignature(signer.email)).toBeUndefined();

  // A second POST (second tab, double click) is "already used", not an error.
  const response = secondTab.waitForResponse((r) => r.request().method() === 'POST');
  await secondTab.getByRole('button', { name: 'Delete my signature' }).click();
  expect((await response).status()).toBe(200);
  await expect(secondTab.getByRole('heading', { level: 1 })).toHaveText(
    'This link was already used.',
  );
  await secondTab.close();

  await page.goto(link.path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This link was already used.');
  await expect(page.getByRole('button', { name: 'Delete my signature' })).toHaveCount(0);
});

test('a valid link whose signature is already gone shows "deleted"', async ({ page, context }) => {
  test.setTimeout(180_000);
  const signer = uniqueSigner('gone');
  const signMailId = await signAndConfirm(page, signer);
  await fillWithdrawForm(page, signer.email);
  await solveAltcha(page);
  await submitWithdrawForm(page);
  await expect(page).toHaveURL(/\/en\/withdraw\/check-email$/);
  const first = await withdrawPathFromMail(signer.email, [signMailId]);

  // A second request gives a second valid link; the first one deletes the signature.
  await fillWithdrawForm(page, signer.email);
  await solveAltcha(page);
  await submitWithdrawForm(page);
  await expect(page).toHaveURL(/\/en\/withdraw\/check-email$/);
  const second = await withdrawPathFromMail(signer.email, [signMailId, first.id]);
  expect(second.path).not.toBe(first.path);

  // The second link is open with its button showing when the first one deletes the signature.
  const secondTab = await context.newPage();
  await secondTab.goto(second.path);
  await expect(secondTab.getByRole('button', { name: 'Delete my signature' })).toBeVisible();

  await page.goto(first.path);
  await page.getByRole('button', { name: 'Delete my signature' }).click();
  await expect(page).toHaveURL(/\/en\/withdraw\/done$/);
  expect(findSignature(signer.email)).toBeUndefined();

  // Valid token, nothing left to delete: still "done".
  await secondTab.getByRole('button', { name: 'Delete my signature' }).click();
  await expect(secondTab).toHaveURL(/\/en\/withdraw\/done$/);

  // Opening a valid link for a signature that is gone says so and offers no button.
  await page.goto(seedWithdrawLink({ withSignature: false }));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'There is no signature for this address any more.',
  );
  await expect(page.getByRole('button', { name: 'Delete my signature' })).toHaveCount(0);
});

test('an address that never signed gets the identical answer and no mail', async ({ page }) => {
  test.setTimeout(180_000);
  const signer = uniqueSigner('known');
  const stranger = uniqueSigner('stranger');
  const signMailId = await signAndConfirm(page, signer);

  async function answerFor(email: string) {
    await fillWithdrawForm(page, email);
    await solveAltcha(page);
    const posted = page.waitForResponse((r) => r.request().method() === 'POST');
    await submitWithdrawForm(page);
    const response = await posted;
    await expect(page).toHaveURL(/\/en\/withdraw\/check-email$/);
    return {
      status: response.status(),
      location: response.headers().location,
      body: await page.locator('main').textContent(),
    };
  }

  const known = await answerFor(signer.email);
  const unknown = await answerFor(stranger.email);
  expect(known.status).toBe(303);
  expect(unknown).toEqual(known);

  await withdrawPathFromMail(signer.email, [signMailId]);
  await page.waitForTimeout(5_000);
  expect(await mailIdsTo(stranger.email)).toEqual([]);
  expect(queuedMailCount(stranger.email)).toBe(0);
});

test('an invalid email shows a focused error summary and keeps the value', async ({ page }) => {
  await fillWithdrawForm(page, 'not-an-email');
  await solveAltcha(page);
  await submitWithdrawForm(page);

  const summary = page.locator('#form-errors');
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('link', { name: 'Enter a valid email address.' })).toHaveAttribute(
    'href',
    '#email',
  );
  const email = page.getByLabel('Email address');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription(/^Enter a valid email address\./);
  await expect(email).toHaveValue('not-an-email');
});

test('a filled honeypot looks like success but sends no mail', async ({ page }) => {
  const signer = uniqueSigner('wd-honeypot');
  await fillWithdrawForm(page, signer.email);
  await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
    el.value = 'https://spam.example';
  });
  await solveAltcha(page);
  await submitWithdrawForm(page);
  await expect(page).toHaveURL(/\/en\/withdraw\/check-email$/);
  await page.waitForTimeout(5_000);
  expect(await mailIdsTo(signer.email)).toEqual([]);
  expect(queuedMailCount(signer.email)).toBe(0);
});

test('an unknown or missing token links back to the form', async ({ page }) => {
  for (const path of ['/en/withdraw/confirm?token=nope', '/en/withdraw/confirm']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByText('This link is not valid or has expired.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/en/withdraw',
    );
    await expect(page.getByRole('button', { name: 'Delete my signature' })).toHaveCount(0);
  }
});

test('a confirm POST with an unknown token changes nothing', async ({ request }) => {
  const response = await request.post('/en/withdraw/confirm', { form: { token: 'nope' } });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('This link is not valid or has expired.');
});

test('withdraw pages are not indexed', async ({ page }) => {
  for (const path of [
    '/en/withdraw',
    '/en/withdraw/check-email',
    '/en/withdraw/confirm?token=nope',
    '/en/withdraw/done',
  ]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  }
});

test('withdraw pages under an unknown locale are 404', async ({ request }) => {
  for (const path of [
    '/xx/withdraw',
    '/xx/withdraw/check-email',
    '/xx/withdraw/confirm',
    '/xx/withdraw/done',
  ]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('the sign thanks page links to withdrawing', async ({ page }) => {
  await page.goto('/en/sign/thanks');
  await expect(page.getByRole('link', { name: 'Withdraw your signature' })).toHaveAttribute(
    'href',
    '/en/withdraw',
  );
});
