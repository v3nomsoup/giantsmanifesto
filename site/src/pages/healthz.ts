import type { APIRoute } from 'astro';
import { getDb } from '../lib/db';

export const GET: APIRoute = () => {
  try {
    getDb().$client.prepare('select 1').get();
  } catch {
    return new Response('database unavailable', {
      status: 503,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return new Response('ok', { headers: { 'content-type': 'text/plain' } });
};
