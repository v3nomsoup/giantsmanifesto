import type { Db } from './db';
import { deleteSignature, findByEmailHash } from './signatures';
import { consumeToken } from './tokens';

export type WithdrawResult =
  | { ok: true; deleted: boolean }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

/**
 * Spends a `withdraw` token and deletes the signature it names in one transaction, so a
 * failed delete leaves the link usable. A valid token whose signature is already gone is
 * still a success (`deleted: false`).
 */
export function withdrawByToken(db: Db, raw: string): WithdrawResult {
  // better-sqlite3 turns the `immediate` transaction inside consumeToken into a savepoint
  // when one is already open. The outer one is immediate too, so the write lock is taken up
  // front instead of being upgraded half way (which can fail with SQLITE_BUSY).
  return db.transaction(
    () => {
      const result = consumeToken<{ emailHash: string }>(db, raw, 'withdraw');
      if (!result.ok) return result;
      const existing = findByEmailHash(db, result.payload.emailHash);
      if (existing) deleteSignature(db, existing.id);
      return { ok: true, deleted: Boolean(existing) };
    },
    { behavior: 'immediate' },
  );
}
