import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';
import type { Db } from './db';
import { emailTokens } from './db/schema';

export type TokenPurpose = 'sign' | 'withdraw';

export const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export type TokenResult<T> =
  | { ok: true; payload: T }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' };

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** Creates a single-use token and returns the raw value. Only its hash is stored. */
export function createToken(
  db: Db,
  purpose: TokenPurpose,
  payload: unknown,
  now: number = Date.now(),
): string {
  const raw = randomBytes(32).toString('base64url');
  db.insert(emailTokens)
    .values({
      tokenHash: hashToken(raw),
      purpose,
      payload: JSON.stringify(payload ?? {}),
      createdAt: now,
      expiresAt: now + TOKEN_TTL_MS,
    })
    .run();
  return raw;
}

type Row = typeof emailTokens.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function judge<T>(row: Row | undefined, now: number): TokenResult<T> {
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.usedAt !== null) return { ok: false, reason: 'used' };
  if (now > row.expiresAt) return { ok: false, reason: 'expired' };
  return { ok: true, payload: JSON.parse(row.payload) as T };
}

function findRow(db: Db | Tx, raw: string, purpose: TokenPurpose): Row | undefined {
  return db
    .select()
    .from(emailTokens)
    .where(and(eq(emailTokens.tokenHash, hashToken(raw)), eq(emailTokens.purpose, purpose)))
    .get();
}

/** Checks a token without consuming it. */
export function peekToken<T = unknown>(
  db: Db,
  raw: string,
  purpose: TokenPurpose,
  now: number = Date.now(),
): TokenResult<T> {
  return judge<T>(findRow(db, raw, purpose), now);
}

/**
 * Checks and marks a token used in one immediate transaction. The conditional
 * UPDATE guards against a second consume racing in between.
 */
export function consumeToken<T = unknown>(
  db: Db,
  raw: string,
  purpose: TokenPurpose,
  now: number = Date.now(),
): TokenResult<T> {
  return db.transaction(
    (tx) => {
      const row = findRow(tx, raw, purpose);
      const result = judge<T>(row, now);
      if (!result.ok || !row) return result;
      const changed = tx
        .update(emailTokens)
        .set({ usedAt: now })
        .where(and(eq(emailTokens.id, row.id), isNull(emailTokens.usedAt)))
        .run().changes;
      return changed === 1 ? result : { ok: false, reason: 'used' };
    },
    { behavior: 'immediate' },
  );
}

/** Deletes expired and used tokens. Returns the number removed. */
export function deleteStaleTokens(db: Db, now: number = Date.now()): number {
  return db
    .delete(emailTokens)
    .where(or(lt(emailTokens.expiresAt, now), isNotNull(emailTokens.usedAt)))
    .run().changes;
}
