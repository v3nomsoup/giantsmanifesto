import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import { describe, expect, it } from 'vitest';
import { type Config, readConfig } from '../../src/lib/config';
import { createAltchaChallenge, verifyAltcha } from '../../src/lib/security/altcha';

const config = (extra: Record<string, string> = {}): Config =>
  readConfig({ SESSION_SECRET: 's3cret-for-tests', ALTCHA_MAX_NUMBER: '1000', ...extra });

async function solvedPayload(cfg: Config): Promise<string> {
  const challenge = await createAltchaChallenge(cfg);
  const solution = await solveChallenge({ challenge, deriveKey });
  if (!solution) throw new Error('unsolved');
  return btoa(JSON.stringify({ challenge, solution }));
}

describe('ALTCHA', () => {
  it('accepts a solved challenge once and rejects the replay', async () => {
    const cfg = config();
    const payload = await solvedPayload(cfg);
    expect(await verifyAltcha(payload, cfg)).toBe(true);
    expect(await verifyAltcha(payload, cfg)).toBe(false);
  });

  it('accepts exactly one of several concurrent submissions of the same payload', async () => {
    const cfg = config();
    const payload = await solvedPayload(cfg);
    const results = await Promise.all(Array.from({ length: 5 }, () => verifyAltcha(payload, cfg)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('rejects a tampered payload', async () => {
    const cfg = config();
    const decoded = JSON.parse(atob(await solvedPayload(cfg)));
    decoded.challenge.parameters.keyPrefix = '00';
    expect(await verifyAltcha(btoa(JSON.stringify(decoded)), cfg)).toBe(false);
    decoded.solution.counter += 1;
    expect(await verifyAltcha(btoa(JSON.stringify(decoded)), cfg)).toBe(false);
  });

  it('rejects a payload signed with another secret', async () => {
    const payload = await solvedPayload(config({ SESSION_SECRET: 'other-secret' }));
    expect(await verifyAltcha(payload, config())).toBe(false);
  });

  it('rejects missing, empty and malformed payloads', async () => {
    const cfg = config();
    expect(await verifyAltcha(null, cfg)).toBe(false);
    expect(await verifyAltcha('', cfg)).toBe(false);
    expect(await verifyAltcha('not-base64-json!', cfg)).toBe(false);
    expect(await verifyAltcha(btoa('{"challenge":null,"solution":null}'), cfg)).toBe(false);
  });

  it('rejects an expired challenge', async () => {
    const cfg = config();
    const payload = await solvedPayload(cfg);
    expect(await verifyAltcha(payload, cfg, Date.now() + 11 * 60 * 1000)).toBe(false);
  });

  it('needs SESSION_SECRET', async () => {
    const cfg = readConfig({ ALTCHA_MAX_NUMBER: '1000' });
    await expect(createAltchaChallenge(cfg)).rejects.toThrow();
    expect(await verifyAltcha('x', cfg)).toBe(false);
  });
});
