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

for (const size of [
  { width: 1280, height: 800 },
  { width: 375, height: 800 },
]) {
  test(`homepage drawing does not overlap the headline at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/en/');
    const drawing = page.locator('.convergence--full');
    if (!(await drawing.isVisible())) return;
    const a = await drawing.boundingBox();
    const b = await page.locator('h1').boundingBox();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (!a || !b) return;
    const overlaps =
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlaps).toBe(false);
  });
}

test('full drawing has eight curves and one apex', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('.convergence--full path')).toHaveCount(8);
  await expect(page.locator('.convergence--full .convergence-apex')).toHaveCount(1);
});
