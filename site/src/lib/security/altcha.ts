import { type Challenge, createChallenge, randomInt, verifySolution } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import type { Config } from '../config';

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_PAYLOAD_LENGTH = 8192;
const ALGORITHM = 'SHA-256';

/** Verified challenge signatures and when they expire (ms); in process memory. */
const used = new Map<string, number>();

function secrets(config: Config) {
  if (!config.sessionSecret) throw new Error('SESSION_SECRET is required for ALTCHA');
  return {
    hmacSignatureSecret: config.sessionSecret,
    // Separate key for the derived-key signature, so one secret is not used for two jobs.
    hmacKeySignatureSecret: `${config.sessionSecret}:altcha-key`,
  };
}

/**
 * Deterministic-mode challenge: the server picks the counter (so the browser needs at most
 * `altchaMaxNumber` hashes) and signs the derived key, so verifying costs one HMAC.
 */
export async function createAltchaChallenge(config: Config): Promise<Challenge> {
  const max = Math.max(1, config.altchaMaxNumber);
  return createChallenge({
    algorithm: ALGORITHM,
    cost: 1,
    counter: randomInt(max, Math.ceil(max / 2)),
    deriveKey,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    ...secrets(config),
  });
}

function decode(payload: string): { challenge: Challenge; solution: unknown } | null {
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (!json || typeof json !== 'object' || !json.challenge?.parameters) return null;
    return json;
  } catch {
    return null;
  }
}

/** True once for a correctly solved, unexpired, server-issued challenge; replays are false. */
export async function verifyAltcha(
  payload: string | null,
  config: Config,
  now: number = Date.now(),
): Promise<boolean> {
  if (!payload || payload.length > MAX_PAYLOAD_LENGTH || !config.sessionSecret) return false;
  for (const [signature, expires] of used) {
    if (expires <= now) used.delete(signature);
  }
  const decoded = decode(payload);
  if (!decoded) return false;
  const { challenge, solution } = decoded;
  const { signature, parameters } = challenge;
  if (typeof signature !== 'string' || used.has(signature)) return false;
  const expiresAt = parameters.expiresAt;
  if (typeof expiresAt !== 'number' || expiresAt * 1000 <= now) return false;
  try {
    const result = await verifySolution({
      challenge,
      solution: solution as never,
      deriveKey,
      ...secrets(config),
    });
    if (!result.verified) return false;
  } catch {
    return false;
  }
  used.set(signature, expiresAt * 1000);
  return true;
}
