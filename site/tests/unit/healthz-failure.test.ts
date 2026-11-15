import type { APIContext } from 'astro';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/db', () => ({
  getDb: () => {
    throw Object.assign(new Error('unable to open /data/app.db'), { code: 'SQLITE_CANTOPEN' });
  },
}));

const { GET } = await import('../../src/pages/healthz');

describe('GET /healthz without a database', () => {
  it('answers 503 and logs only the error code', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await GET({} as APIContext);
    expect(response.status).toBe(503);
    const logged = JSON.stringify(log.mock.calls);
    log.mockRestore();
    expect(logged).toContain('SQLITE_CANTOPEN');
    expect(logged).not.toContain('/data/app.db');
  });
});
