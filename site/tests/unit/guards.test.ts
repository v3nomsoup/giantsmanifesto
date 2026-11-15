import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../../src/lib/config';
import { createAltchaChallenge } from '../../src/lib/security/altcha';
import { checkFormGuards, getFormLimiter } from '../../src/lib/security/guards';

// The limiter reads its limit from the process environment on first use.
process.env.RATE_LIMIT_MAX = '3';

const config = readConfig({
  SESSION_SECRET: 's3cret-for-tests',
  ALTCHA_MAX_NUMBER: '1000',
  RATE_LIMIT_MAX: '3',
});

async function validForm(extra: Record<string, string> = {}): Promise<FormData> {
  const challenge = await createAltchaChallenge(config);
  const solution = await solveChallenge({ challenge, deriveKey });
  const form = new FormData();
  form.set('altcha', btoa(JSON.stringify({ challenge, solution })));
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return form;
}

describe('checkFormGuards', () => {
  it('creates the limiter lazily and once', () => {
    expect(getFormLimiter()).toBe(getFormLimiter());
  });

  it('returns honeypot without counting against the rate limit', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await checkFormGuards(await validForm({ website: 'x' }), 'ip-h', config)).toBe(
        'honeypot',
      );
    }
    expect(await checkFormGuards(await validForm(), 'ip-h', config)).toBe('ok');
  });

  it('rate limits every non-honeypot submission, before ALTCHA', async () => {
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(await checkFormGuards(new FormData(), 'ip-r', config));
    }
    expect(results).toEqual(['altcha', 'altcha', 'altcha', 'rate_limited', 'rate_limited']);
  });

  it('rejects a missing ALTCHA payload and a replay', async () => {
    expect(await checkFormGuards(new FormData(), 'ip-a', config)).toBe('altcha');
    const form = await validForm();
    expect(await checkFormGuards(form, 'ip-b', config)).toBe('ok');
    expect(await checkFormGuards(form, 'ip-c', config)).toBe('altcha');
  });
});
