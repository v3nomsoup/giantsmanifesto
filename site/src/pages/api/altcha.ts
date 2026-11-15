import type { APIRoute } from 'astro';
import { readConfig, signingEnabled } from '../../lib/config';
import { createAltchaChallenge } from '../../lib/security/altcha';

export const prerender = false;

const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };

export const GET: APIRoute = async () => {
  const config = readConfig();
  if (!signingEnabled(config)) {
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers });
  }
  return new Response(JSON.stringify(await createAltchaChallenge(config)), { headers });
};
