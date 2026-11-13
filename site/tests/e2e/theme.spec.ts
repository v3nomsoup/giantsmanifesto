import { expect, test } from '@playwright/test';

const publicPages = [
  '/en/',
  '/en/manifesto',
  '/en/changelog',
  '/en/contact',
  '/en/privacy',
  '/en/imprint',
];

const bodyBg = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('light system', () => {
  test.use({ colorScheme: 'light' });

  test('toggle switches light to dark and back', async ({ page }) => {
    await page.goto('/en/');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
    expect(await bodyBg(page)).toBe('rgb(21, 26, 32)');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await bodyBg(page)).toBe('rgb(238, 241, 243)');
  });

  test('choice survives a reload', async ({ page }) => {
    await page.goto('/en/');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await bodyBg(page)).toBe('rgb(21, 26, 32)');
  });
});

test.describe('dark system', () => {
  test.use({ colorScheme: 'dark' });

  test('stored light beats a dark system setting', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'light'));
    await page.goto('/en/');
    expect(await bodyBg(page)).toBe('rgb(238, 241, 243)');
  });

  test('invalid stored value falls back to the system theme', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (e) => errors.push(e));
    await page.addInitScript(() => localStorage.setItem('theme', 'blue'));
    await page.goto('/en/');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    expect(await bodyBg(page)).toBe('rgb(21, 26, 32)');
    expect(errors).toEqual([]);
  });

  test('throwing localStorage falls back without errors', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (e) => errors.push(e));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('denied');
        },
      });
    });
    await page.goto('/en/');
    expect(await bodyBg(page)).toBe('rgb(21, 26, 32)');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(errors).toEqual([]);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the toggle is hidden', async ({ page }) => {
    await page.goto('/en/');
    await expect(page.locator('.theme-toggle')).toBeHidden();
  });
});

test('no request leaves our origin', async ({ page, baseURL }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  for (const path of publicPages) {
    await page.goto(path);
  }
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect(url.startsWith(baseURL ?? '') || url.startsWith('data:')).toBe(true);
  }
});
