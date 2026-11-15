import type { APIRoute } from 'astro';
import { getDb } from '../lib/db';

export const GET: APIRoute = () => {
  try {
    getDb().$client.prepare('select 1').get();
  } catch (error) {
    // Code or name only: the message can hold the database path.
    const { code, name } = (error ?? {}) as { code?: unknown; name?: unknown };
    console.error(`healthz: database unavailable (${String(code ?? name ?? 'error')})`);
    return new Response('database unavailable', {
      status: 503,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return new Response('ok', { headers: { 'content-type': 'text/plain' } });
};
