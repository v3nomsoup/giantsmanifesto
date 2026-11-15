import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { seedSignatures } from './signing';

/** A tag unique to one test, so searching for it isolates its rows from other specs' rows. */
const uniqueTag = () => `Tag${randomBytes(5).toString('hex')}`;

test('the list shows visible signatures newest first with badge, country and date, never hidden ones', async ({
  page,
}) => {
  const t = uniqueTag();
  const day = Date.UTC(2026, 0, 15, 23, 30);
  const [olderId, newerId] = seedSignatures([
    {
      displayName: `Ada ${t}`,
      affiliation: `Analytical Engines ${t}`,
      country: 'GB',
      createdAt: day,
    },
    { displayName: `Grace ${t}`, affiliation: `Navy ${t}`, country: 'US', createdAt: day + 1000 },
    { displayName: `Hidden ${t}`, affiliation: t, createdAt: day + 2000, hidden: true },
    { displayName: `<script>alert(1)</script> ${t}`, affiliation: t, createdAt: day - 1000 },
  ]);

  await page.goto(`/en/signatures?q=${t}`);
  const items = page.locator('.signature-list > li');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText(`Grace ${t}`);
  await expect(items.nth(1)).toContainText(`Ada ${t}`);
  await expect(items.nth(2)).toContainText(`<script>alert(1)</script> ${t}`);
  await expect(page.getByText(`Hidden ${t}`)).toHaveCount(0);

  const ada = items.nth(1);
  await expect(ada).toContainText(`Analytical Engines ${t}`);
  await expect(ada).toContainText('United Kingdom');
  await expect(ada).toContainText('Jan 15, 2026');
  await expect(ada.getByText('Email confirmed')).toBeVisible();
  await expect(items.nth(0)).toHaveAttribute('id', `signature-${newerId}`);
  await expect(ada).toHaveAttribute('id', `signature-${olderId}`);
});

test('a script in a name is shown as text, not run', async ({ page }) => {
  const t = uniqueTag();
  seedSignatures([{ displayName: `<script>window.__pwned = 1</script> ${t}` }]);
  await page.goto(`/en/signatures?q=${t}`);
  await expect(page.locator('.signature-list')).toContainText(
    '<script>window.__pwned = 1</script>',
  );
  const pwned = await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned);
  expect(pwned).toBeUndefined();
});

test('searching an affiliation narrows the list; a search with no match says so', async ({
  page,
}) => {
  const t = uniqueTag();
  seedSignatures([
    { displayName: `Ada ${t}`, affiliation: `Analytical Engines ${t}` },
    { displayName: `Grace ${t}`, affiliation: `Navy ${t}` },
  ]);
  // A search link shows the box even below the 51 signatures that bring it up on its own.
  await page.goto(`/en/signatures?q=${t}`);
  await page.getByLabel('Search').fill(`Navy ${t}`);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/en\/signatures\?q=/);
  await expect(page.locator('.signature-list > li')).toHaveCount(1);
  await expect(page.locator('.signature-list')).toContainText(`Grace ${t}`);
  await expect(page.getByLabel('Search')).toHaveValue(`Navy ${t}`);

  await page.goto(`/en/signatures?q=${t}-nothing`);
  await expect(page.locator('.signature-list')).toHaveCount(0);
  await expect(page.getByText('No signatures match your search.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Show all signatures' })).toHaveAttribute(
    'href',
    '/en/signatures',
  );
});

test('with 51 matches, page 2 has one entry and a Previous link; page 1 has Next', async ({
  page,
}) => {
  const t = uniqueTag();
  const base = Date.now() - 100_000;
  seedSignatures(
    Array.from({ length: 51 }, (_, i) => ({
      displayName: `Person ${String(i).padStart(2, '0')} ${t}`,
      affiliation: t,
      createdAt: base + i,
    })),
  );
  await page.goto(`/en/signatures?q=${t}`);
  await expect(page.locator('.signature-list > li')).toHaveCount(50);
  await expect(page.getByRole('link', { name: 'Previous' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Next' })).toHaveAttribute(
    'href',
    `/en/signatures?q=${t}&page=2`,
  );

  await page.getByRole('link', { name: 'Next' }).click();
  await expect(page.locator('.signature-list > li')).toHaveCount(1);
  await expect(page.locator('.signature-list')).toContainText(`Person 00 ${t}`);
  await expect(page.getByRole('link', { name: 'Next' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Previous' })).toHaveAttribute(
    'href',
    `/en/signatures?q=${t}`,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('a page past the end shows the empty state with a link back, not an error', async ({
  page,
}) => {
  const response = await page.goto('/en/signatures?page=999');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('There are no signatures on this page.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the first page' })).toHaveAttribute(
    'href',
    '/en/signatures',
  );
});

test('page numbers that are not positive whole numbers count as page 1', async ({ page }) => {
  const t = uniqueTag();
  seedSignatures([{ displayName: `Ada ${t}`, affiliation: t }]);
  for (const value of ['abc', '0', '-3', '1.5']) {
    const response = await page.goto(`/en/signatures?q=${t}&page=${value}`);
    expect(response?.status(), value).toBe(200);
    await expect(page.locator('.signature-list > li'), value).toHaveCount(1);
  }
});

test('the search text is trimmed and capped at 100 characters', async ({ page }) => {
  const t = uniqueTag();
  seedSignatures([{ displayName: `Ada ${t}`, affiliation: t }]);
  await page.goto(`/en/signatures?q=${encodeURIComponent(`   ${t}   `)}`);
  await expect(page.locator('.signature-list > li')).toHaveCount(1);
  await expect(page.getByLabel('Search')).toHaveValue(t);

  await page.goto(`/en/signatures?q=${'a'.repeat(300)}`);
  await expect(page.getByLabel('Search')).toHaveValue('a'.repeat(100));
});

test('only the plain list is indexable', async ({ page }) => {
  await page.goto('/en/signatures');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/signatures$/);
  await page.goto('/en/signatures?q=x');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await page.goto('/en/signatures?page=2');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('an unknown locale is 404', async ({ request }) => {
  expect((await request.get('/xx/signatures')).status()).toBe(404);
});
