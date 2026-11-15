import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { fillSignForm, seedWithdrawLink, solveAltcha, submitSignForm } from './signing';

const publicPages = [
  '/en/',
  '/en/manifesto',
  '/en/changelog',
  '/en/contact',
  '/en/privacy',
  '/en/imprint',
  '/en/sign',
  '/en/sign/check-email',
  '/en/sign/confirm?token=nope',
  '/en/sign/thanks',
  '/en/sign/thanks?already=1',
  '/en/withdraw',
  '/en/withdraw/check-email',
  '/en/withdraw/confirm?token=nope',
  '/en/withdraw/done',
];

/** The sign form after a submission with errors in several fields. */
async function showSignFormErrors(page: Page) {
  await fillSignForm(page, { name: '   ', email: 'not-an-email' });
  await page.getByLabel(/^I agree/).uncheck();
  await solveAltcha(page);
  await submitSignForm(page);
  await expect(page.locator('#form-errors')).toBeFocused();
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    for (const path of publicPages) {
      test(`${path} has no accessibility violations`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }

    test('the sign form with errors has no accessibility violations', async ({ page }) => {
      await showSignFormErrors(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test('the withdraw confirm page with a valid link has no accessibility violations', async ({
      page,
    }) => {
      await page.goto(seedWithdrawLink());
      await expect(page.getByRole('button', { name: 'Delete my signature' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`explicit ${theme} theme`, () => {
    test('the 404 page has no accessibility violations', async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      const response = await page.goto('/en/nope');
      expect(response?.status()).toBe(404);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test('the sign form with errors has no accessibility violations', async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await showSignFormErrors(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test('the withdraw confirm page with a valid link has no accessibility violations', async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
      await page.goto(seedWithdrawLink());
      await expect(page.getByRole('button', { name: 'Delete my signature' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    for (const path of publicPages) {
      test(`${path} has no accessibility violations`, async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}

for (const path of publicPages) {
  test(`${path} fits a 375px wide screen`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
