import { expect, test } from '@playwright/test';
import { mailIdsTo } from './mailpit';
import {
  confirmPathFromMail,
  fillSignForm,
  listedNames,
  queuedMailCount,
  solveAltcha,
  submitSignForm,
  uniqueSigner,
} from './signing';

test('signing by email: form, mail, confirm by POST, then "already used" and "already signed"', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(180_000);
  const signer = uniqueSigner('flow');

  await fillSignForm(page, { ...signer, affiliation: 'Analytical Engines', country: 'GB' });
  await solveAltcha(page);
  await submitSignForm(page);
  await expect(page).toHaveURL(/\/en\/sign\/check-email$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check your email');

  const first = await confirmPathFromMail(signer.email);

  // Opening the link (as a mail scanner would) shows the summary but does not sign.
  await page.goto(first.path);
  const summary = page.locator('main');
  await expect(summary.getByText(signer.name)).toBeVisible();
  await expect(summary.getByText('Analytical Engines')).toBeVisible();
  await expect(summary.getByText('United Kingdom')).toBeVisible();
  await page.reload();
  expect(await listedNames(request, signer.name)).toEqual([]);

  // The same link open in a second tab: its Confirm button is clicked after the first one.
  const secondTab = await context.newPage();
  await secondTab.goto(first.path);

  await page.getByRole('button', { name: 'Confirm signature' }).click();
  await expect(page).toHaveURL(/\/en\/sign\/thanks$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thank you for signing');
  expect(await listedNames(request, signer.name)).toEqual([signer.name]);

  // A second POST (double click, second tab or resent form) is "already used", not an error.
  const response = secondTab.waitForResponse((r) => r.request().method() === 'POST');
  await secondTab.getByRole('button', { name: 'Confirm signature' }).click();
  expect((await response).status()).toBe(200);
  await expect(secondTab.getByRole('heading', { level: 1 })).toHaveText(
    'This link was already used.',
  );
  await secondTab.close();
  expect(await listedNames(request, signer.name)).toEqual([signer.name]);

  // Opening the link again.
  await page.goto(first.path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This link was already used.');
  await expect(page.getByRole('link', { name: 'See all signatures' })).toHaveAttribute(
    'href',
    '/en/signatures',
  );
  await expect(page.getByRole('button', { name: 'Confirm signature' })).toHaveCount(0);

  // Signing again with the same address in different case.
  await fillSignForm(page, { name: `${signer.name} again`, email: signer.email.toUpperCase() });
  await solveAltcha(page);
  await submitSignForm(page);
  await expect(page).toHaveURL(/\/en\/sign\/check-email$/);
  const second = await confirmPathFromMail(signer.email, [first.id]);
  await page.goto(second.path);
  await page.getByRole('button', { name: 'Confirm signature' }).click();
  await expect(page).toHaveURL(/\/en\/sign\/thanks\?already=1&id=\d+$/);
  await expect(page.getByText('You have already signed.')).toBeVisible();
  // The link leads to the existing entry in the list, by id only (no personal data in the URL).
  const entryLink = page.getByRole('link', { name: 'See all signatures' });
  await expect(entryLink).toHaveAttribute('href', /^\/en\/signatures#signature-\d+$/);
  expect(await listedNames(request, signer.name)).toEqual([signer.name]);
});

test('a form with an invalid email shows a focused error summary and keeps the name', async ({
  page,
}) => {
  const signer = uniqueSigner('invalid');
  await fillSignForm(page, { name: signer.name, email: 'not-an-email' });
  await solveAltcha(page);
  await submitSignForm(page);

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
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(signer.name);
  await expect(page.getByLabel('Name', { exact: true })).not.toHaveAttribute(
    'aria-invalid',
    'true',
  );
});

test('a filled honeypot looks like success but sends no mail', async ({ page }) => {
  const signer = uniqueSigner('honeypot');
  await fillSignForm(page, signer);
  await page.locator('input[name="website"]').evaluate((el: HTMLInputElement) => {
    el.value = 'https://spam.example';
  });
  await solveAltcha(page);
  await submitSignForm(page);
  await expect(page).toHaveURL(/\/en\/sign\/check-email$/);
  expect(queuedMailCount(signer.email)).toBe(0);
  await page.waitForTimeout(5_000);
  expect(await mailIdsTo(signer.email)).toEqual([]);
  expect(queuedMailCount(signer.email)).toBe(0);
});

test('an unknown or missing token links back to the form', async ({ page }) => {
  for (const path of ['/en/sign/confirm?token=nope', '/en/sign/confirm']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByText('This link is not valid or has expired.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign the manifesto again' })).toHaveAttribute(
      'href',
      '/en/sign',
    );
    await expect(page.getByRole('button', { name: 'Confirm signature' })).toHaveCount(0);
  }
});

test('a confirm POST with an unknown token changes nothing', async ({ request }) => {
  const response = await request.post('/en/sign/confirm', { form: { token: 'nope' } });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('This link is not valid or has expired.');
});

test('signing pages are not indexed', async ({ page }) => {
  for (const path of [
    '/en/sign',
    '/en/sign/check-email',
    '/en/sign/confirm?token=nope',
    '/en/sign/thanks',
  ]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  }
});

test('signing pages under an unknown locale are 404', async ({ request }) => {
  for (const path of ['/xx/sign', '/xx/sign/check-email', '/xx/sign/confirm', '/xx/sign/thanks']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
