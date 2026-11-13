import { expect, test } from '@playwright/test';

test('root redirects to the English homepage', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
  const response = await request.get('/', { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toMatch(/\/en\/$/);
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

test('pages work with and without a trailing slash', async ({ page }) => {
  for (const path of ['/en/manifesto', '/en/manifesto/']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
  }
});

test('canonical URLs drop the trailing slash except on the locale root', async ({ page }) => {
  await page.goto('/en/manifesto/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/manifesto$/);
  await page.goto('/en/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/$/);
});

test('404 page is not indexable and has no canonical', async ({ page }) => {
  await page.goto('/xx/manifesto');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('unknown locale returns 404', async ({ page }) => {
  const response = await page.goto('/xx/manifesto');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

test('homepage shows the core statement, values, a link to the full text and who is behind it', async ({
  page,
}) => {
  await page.goto('/en/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^The machines that will shape our century/,
  );
  const common = page.locator('.values li', { hasText: 'Common good' });
  await expect(common.getByText('Common good', { exact: true })).toBeVisible();
  await expect(common.getByText('over private profit')).toBeVisible();
  await page.getByRole('link', { name: 'Read the full text' }).click();
  await expect(page).toHaveURL(/\/en\/manifesto$/);
});

test('about section names the initiator in a personal capacity', async ({ page }) => {
  await page.goto('/en/#about');
  const about = page.locator('#about');
  await expect(about).toContainText('in a personal capacity');
  await expect(about.getByRole('link', { name: 'Philipp Eckert' })).toHaveAttribute(
    'href',
    'https://eckert.rocks',
  );
  await expect(about.getByRole('link', { name: 'Computerkunst e.V.' })).toHaveAttribute(
    'href',
    'https://computerkunst.info',
  );
});

test('contact page links the initiator to their homepage', async ({ page }) => {
  await page.goto('/en/contact');
  const main = page.locator('main');
  await expect(main.getByRole('link', { name: 'Philipp Eckert' })).toHaveAttribute(
    'href',
    'https://eckert.rocks',
  );
  await expect(main.getByRole('link', { name: "Who's behind this" })).toHaveCount(0);
});

test('contact page shows the contact address', async ({ page }) => {
  await page.goto('/en/contact');
  await expect(page.getByRole('link', { name: 'contact@giantsmanifesto.org' })).toHaveAttribute(
    'href',
    'mailto:contact@giantsmanifesto.org',
  );
});

test('legal pages render their headings', async ({ page }) => {
  await page.goto('/en/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  await page.goto('/en/imprint');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Imprint');
});

test.describe('manifesto reading layout', () => {
  test('TOC marks the section in view on wide screens', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/manifesto#preamble');
    await page.locator('#call-to-action').scrollIntoViewIfNeeded();
    await expect(page.locator('nav.toc a[href="#call-to-action"]')).toHaveAttribute(
      'aria-current',
      'location',
    );
    await expect(page.locator('nav.toc a[aria-current]')).toHaveCount(1);
  });

  test('TOC stays in view while reading', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/manifesto');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const toc = page.locator('nav.toc');
    await expect(toc).toBeVisible();
    const box = await toc.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    await expect(page.locator('nav.toc a[aria-current]')).toHaveCount(1);
  });

  test('TOC sits above the text on phones', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/en/manifesto');
    const toc = await page.locator('nav.toc').boundingBox();
    const h2 = await page.locator('article h2').first().boundingBox();
    expect((toc?.y ?? 0) + (toc?.height ?? 0)).toBeLessThanOrEqual(h2?.y ?? 0);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('TOC links still navigate', async ({ page }) => {
      await page.goto('/en/manifesto');
      await page.locator('nav.toc').getByRole('link', { name: 'Preamble' }).click();
      await expect(page).toHaveURL(/#preamble$/);
    });
  });
});

test('the about section is separated from the one above by a rule', async ({ page }) => {
  await page.goto('/en/');
  const width = await page.locator('#about').evaluate((el) => getComputedStyle(el).borderTopWidth);
  expect(Number.parseFloat(width)).toBeGreaterThan(0);
});
