import { expect, test } from '@playwright/test';

test('root redirects to the English homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
});

test('manifesto page shows title, version and full text', async ({ page }) => {
  await page.goto('/en/manifesto');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The Shoulders of Giants Manifesto',
  );
  await expect(page.getByText(/^Version \d+(\.\d+)+$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Call to action' })).toBeVisible();
});

test('every table-of-contents link resolves to exactly one heading', async ({ page }) => {
  await page.goto('/en/manifesto');
  const hrefs = await page
    .locator('nav.toc a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(5);
  for (const href of hrefs) {
    await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1);
  }
});

test('changelog lists version 0.1', async ({ page }) => {
  await page.goto('/en/changelog');
  await expect(page.getByRole('heading', { name: /^0\.1/ })).toBeVisible();
});

test('pages work without a trailing slash', async ({ page }) => {
  const response = await page.goto('/en/manifesto/');
  expect(response?.status()).toBe(200);
});

test('unknown locale returns 404', async ({ page }) => {
  const response = await page.goto('/xx/manifesto');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});
