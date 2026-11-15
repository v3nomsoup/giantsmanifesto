import type { Db } from './db';
import { createEmailSignature, type PendingEmailSignature } from './signatures';
import { consumeToken } from './tokens';

export type SignResult =
  | { ok: true; created: true; id: number }
  | { ok: true; created: false; existingId: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/**
 * Spends a `sign` token and creates the signature it describes in one transaction, so a
 * failed insert leaves the link usable. An existing signature for the same address is a
 * success with `created: false`.
 */
export function signByToken(db: Db, raw: string, now: number = Date.now()): SignResult {
  // Immediate for the same reason as in withdrawByToken: the inner transaction in
  // consumeToken becomes a savepoint, so the write lock must be taken here up front.
  return db.transaction(
    () => {
      const result = consumeToken<PendingEmailSignature>(db, raw, 'sign', now);
      if (!result.ok) return result;
      return { ok: true, ...createEmailSignature(db, result.payload, now) };
    },
    { behavior: 'immediate' },
  );
}
