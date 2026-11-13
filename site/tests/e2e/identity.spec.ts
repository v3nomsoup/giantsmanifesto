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

test('homepage drawing is hidden on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/en/');
  await expect(page.locator('.convergence--full')).toBeHidden();
});

for (const size of [
  { width: 1280, height: 800 },
  { width: 1024, height: 800 },
]) {
  test(`homepage drawing does not overlap text at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/en/');
    const drawing = page.locator('.convergence--full');
    await expect(drawing).toBeVisible();
    const a = await drawing.boundingBox();
    expect(a).not.toBeNull();
    if (!a) return;
    expect(a.width).toBeGreaterThanOrEqual(260);
    const rule = await page.locator('header.site-header').boundingBox();
    expect(rule).not.toBeNull();
    if (rule) expect(a.x + a.width).toBeLessThanOrEqual(rule.x + rule.width);
    // The headline may share the drawing's box, but no curve may cross its text.
    const crossings = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const svg = document.querySelector<SVGSVGElement>('.convergence--full');
      if (!h1 || !svg) return -1;
      const range = document.createRange();
      range.selectNodeContents(h1);
      const lines = [...range.getClientRects()];
      const ctm = svg.getScreenCTM();
      if (!ctm) return -1;
      let hits = 0;
      for (const path of svg.querySelectorAll('path')) {
        const length = path.getTotalLength();
        for (let i = 0; i <= 100; i++) {
          const p = path.getPointAtLength((length * i) / 100).matrixTransform(ctm);
          // getScreenCTM and getClientRects both use viewport coordinates.
          if (
            lines.some(
              (r) => p.x >= r.left - 4 && p.x <= r.right + 4 && p.y >= r.top && p.y <= r.bottom,
            )
          )
            hits++;
        }
      }
      return hits;
    });
    expect(crossings).toBe(0);
    for (const selector of ['.hero-quote', '.values']) {
      const b = await page.locator(selector).boundingBox();
      expect(b, selector).not.toBeNull();
      if (!b) continue;
      const overlaps =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps, selector).toBe(false);
    }
  });
}

test('full drawing has eight curves and one apex', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('.convergence--full path')).toHaveCount(8);
  await expect(page.locator('.convergence--full .convergence-apex')).toHaveCount(1);
});
