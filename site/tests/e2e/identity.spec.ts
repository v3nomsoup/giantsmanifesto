import { expect, test } from '@playwright/test';

test('header shows the logo mark inside the home link', async ({ page }) => {
  await page.goto('/en/');
  const brand = page.locator('header a.brand');
  const mark = brand.locator('svg.convergence--mark');
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveAttribute('aria-hidden', 'true');
  const name = await brand.evaluate((el) => (el.textContent ?? '').trim());
  expect(name).toBe('Shoulders of Giants');
  await expect(page.getByRole('link', { name: 'Shoulders of Giants', exact: true })).toBeVisible();
});

test('favicon is the theme-aware mark', async ({ request }) => {
  const response = await request.get('/favicon.svg');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
  expect(await response.text()).toContain('prefers-color-scheme');
});
