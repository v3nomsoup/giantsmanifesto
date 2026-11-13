import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const publicPages = [
  '/en/',
  '/en/manifesto',
  '/en/changelog',
  '/en/contact',
  '/en/privacy',
  '/en/imprint',
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    for (const path of publicPages) {
      test(`${path} has no accessibility violations`, async ({ page }) => {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}

for (const path of publicPages) {
  test(`${path} fits a 375px wide screen`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
