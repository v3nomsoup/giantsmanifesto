import { expect, test } from '@playwright/test';

// Runs against a second server started without SMTP settings (see playwright.config.ts).

test('the homepage says signing opens soon instead of showing the button', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.getByText('Signing opens soon', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign the manifesto' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Read the full text' })).toBeVisible();
});

test('the sign and withdraw pages show the paused notice and no form', async ({ page }) => {
  await page.goto('/en/sign');
  await expect(page.getByText('Signing opens soon.')).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
  await page.goto('/en/withdraw');
  await expect(page.getByText('Withdrawing opens soon, together with signing.')).toBeVisible();
  await expect(page.locator('main form')).toHaveCount(0);
});

test('a POST to /sign or /withdraw answers 503 with the notice and creates nothing', async ({
  request,
}) => {
  const sign = await request.post('/en/sign', {
    form: { displayName: 'Paused Person', email: 'paused@example.org', consent: 'on' },
  });
  expect(sign.status()).toBe(503);
  expect(await sign.text()).toContain('Signing opens soon.');
  const withdraw = await request.post('/en/withdraw', { form: { email: 'paused@example.org' } });
  expect(withdraw.status()).toBe(503);
  expect(await withdraw.text()).toContain('Withdrawing opens soon');

  // Nothing was created: the list is empty and the homepage still invites the first signature.
  const list = await (await request.get('/en/signatures')).text();
  expect(list).not.toContain('Paused Person');
  expect(await (await request.get('/en/')).text()).toContain('Be the first to sign.');
});

test('the public list still works while signing is paused', async ({ page }) => {
  const response = await page.goto('/en/signatures');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Signatures');
});
