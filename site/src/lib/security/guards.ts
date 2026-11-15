import { type Config, readConfig } from '../config';
import { verifyAltcha } from './altcha';
import { FORM_WINDOW_MS, RateLimiter } from './rate-limit';

let formLimiter: RateLimiter | undefined;

/** Created on first use so the limit comes from `RATE_LIMIT_MAX`. */
export function getFormLimiter(): RateLimiter {
  formLimiter ??= new RateLimiter(readConfig().rateLimitMax, FORM_WINDOW_MS);
  return formLimiter;
}

export type GuardResult = 'ok' | 'honeypot' | 'rate_limited' | 'altcha';

/**
 * Order matters: honeypot hits are dropped silently (pages answer as if it worked) and are
 * not counted; every other submission counts against the limit before the ALTCHA check, so
 * failed proofs cannot be retried without limit.
 */
export async function checkFormGuards(
  form: FormData,
  ip: string,
  config: Config,
): Promise<GuardResult> {
  const trap = form.get('website');
  if (typeof trap === 'string' && trap.trim() !== '') return 'honeypot';
  if (!getFormLimiter().hit(ip)) return 'rate_limited';
  const payload = form.get('altcha');
  if (!(await verifyAltcha(typeof payload === 'string' ? payload : null, config))) return 'altcha';
  return 'ok';
}
