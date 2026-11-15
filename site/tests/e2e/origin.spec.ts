import { expect, test } from '@playwright/test';

// Behind Traefik the server sees http://, browsers post from https://giantsmanifesto.org.
// The e2e server is built with SITE_URL=https://giantsmanifesto.org, as production is.
const forwarded = {
  'X-Forwarded-Proto': 'https',
  'X-Forwarded-Host': 'giantsmanifesto.org',
  'X-Forwarded-Port': '443',
  'X-Forwarded-For': '203.0.113.7',
};
const form = { displayName: 'Origin test', email: 'origin@example.org' };

test('a form POST from the production origin through the proxy is accepted', async ({
  request,
}) => {
  const response = await request.post('/en/sign', {
    form,
    headers: { Origin: 'https://giantsmanifesto.org', ...forwarded },
    maxRedirects: 0,
  });
  // Past the origin check, the form is validated: without an ALTCHA proof that is a 400.
  expect(response.status()).toBe(400);
});

test('a form POST from a foreign origin is rejected', async ({ request }) => {
  const response = await request.post('/en/sign', {
    form,
    headers: { Origin: 'https://evil.example', ...forwarded },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});

test('a cross-site form POST is rejected by its Sec-Fetch-Site header', async ({ request }) => {
  const response = await request.post('/en/sign', {
    form,
    headers: { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});

test('the confirm POST is protected the same way', async ({ request }) => {
  const response = await request.post('/en/sign/confirm', {
    form: { token: 'nope' },
    headers: { Origin: 'https://evil.example', ...forwarded },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});
