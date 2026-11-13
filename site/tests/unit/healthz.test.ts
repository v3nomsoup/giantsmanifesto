import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import { GET } from '../../src/pages/healthz';

describe('GET /healthz', () => {
  it('answers 200 with "ok"', async () => {
    const response = await GET({} as APIContext);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});
