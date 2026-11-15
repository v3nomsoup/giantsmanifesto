import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type Db, openDb } from '../../src/lib/db';
import { emailTokens } from '../../src/lib/db/schema';
import {
  consumeToken,
  createToken,
  deleteStaleTokens,
  peekToken,
  TOKEN_TTL_MS,
} from '../../src/lib/tokens';

const opened: Db[] = [];
const open = (dir: string) => {
  const db = openDb(dir);
  opened.push(db);
  return db;
};
afterEach(() => {
  for (const db of opened.splice(0)) db.$client.close();
});

const fresh = () => open(mkdtempSync(join(tmpdir(), 'gm-tokens-')));
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('createToken', () => {
  it('stores only the hash of the raw token', () => {
    const db = fresh();
    const raw = createToken(db, 'sign', { a: 1 }, 1000);
    const rows = db.select().from(emailTokens).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(raw);
    expect(rows[0].tokenHash).toBe(sha256(raw));
    expect(rows[0].payload).toBe(JSON.stringify({ a: 1 }));
    expect(rows[0].expiresAt).toBe(1000 + TOKEN_TTL_MS);
    expect(rows[0].usedAt).toBeNull();
  });

  it('returns a base64url token of 32 random bytes and never repeats', () => {
    const db = fresh();
    const a = createToken(db, 'sign', {});
    const b = createToken(db, 'sign', {});
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe('peekToken', () => {
  it('returns the payload and does not mark the token used', () => {
    const db = fresh();
    const raw = createToken(db, 'sign', { email: 'x' }, 1000);
    expect(peekToken(db, raw, 'sign', 1001)).toEqual({ ok: true, payload: { email: 'x' } });
    expect(peekToken(db, raw, 'sign', 1002)).toEqual({ ok: true, payload: { email: 'x' } });
    expect(db.select().from(emailTokens).all()[0].usedAt).toBeNull();
  });

  it('returns invalid for a token of another purpose', () => {
    const db = fresh();
    const raw = createToken(db, 'sign', {}, 1000);
    expect(peekToken(db, raw, 'withdraw', 1001)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('returns expired just after the TTL', () => {
    const db = fresh();
    const created = 1000;
    const raw = createToken(db, 'sign', {}, created);
    expect(peekToken(db, raw, 'sign', created + TOKEN_TTL_MS + 1)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it.each(['', 'not-a-token', '%%%', 'a'.repeat(5000)])(
    'returns invalid without throwing for %j',
    (raw) => {
      const db = fresh();
      expect(peekToken(db, raw, 'sign', 1000)).toEqual({ ok: false, reason: 'invalid' });
    },
  );
});

describe('consumeToken', () => {
  it('succeeds once, then reports used', () => {
    const db = fresh();
    const raw = createToken(db, 'sign', { n: 2 }, 1000);
    expect(consumeToken(db, raw, 'sign', 1001)).toEqual({ ok: true, payload: { n: 2 } });
    expect(consumeToken(db, raw, 'sign', 1002)).toEqual({ ok: false, reason: 'used' });
    expect(peekToken(db, raw, 'sign', 1003)).toEqual({ ok: false, reason: 'used' });
  });

  it('does not mark a token used when the purpose does not match', () => {
    const db = fresh();
    const raw = createToken(db, 'sign', {}, 1000);
    expect(consumeToken(db, raw, 'withdraw', 1001)).toEqual({ ok: false, reason: 'invalid' });
    expect(consumeToken(db, raw, 'sign', 1002)).toEqual({ ok: true, payload: {} });
  });

  it('returns expired and leaves the token unused', () => {
    const db = fresh();
    const raw = createToken(db, 'sign', {}, 1000);
    expect(consumeToken(db, raw, 'sign', 1000 + TOKEN_TTL_MS + 1)).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(db.select().from(emailTokens).all()[0].usedAt).toBeNull();
  });

  it('yields exactly one ok across two connections to the same database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gm-tokens-race-'));
    const first = open(dir);
    const second = open(dir);
    const raw = createToken(first, 'sign', {}, 1000);
    const results = [
      consumeToken(first, raw, 'sign', 1001),
      consumeToken(second, raw, 'sign', 1001),
    ];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: 'used' }]);
  });
});

describe('deleteStaleTokens', () => {
  it('removes used and expired tokens and keeps a fresh one', () => {
    const db = fresh();
    const now = 10 * TOKEN_TTL_MS;
    const used = createToken(db, 'sign', {}, now - 1000);
    consumeToken(db, used, 'sign', now - 999);
    createToken(db, 'sign', {}, now - TOKEN_TTL_MS - 5000); // expired
    const fresh1 = createToken(db, 'sign', {}, now - 1000);

    expect(deleteStaleTokens(db, now)).toBe(2);
    const left = db.select().from(emailTokens).all();
    expect(left).toHaveLength(1);
    expect(left[0].tokenHash).toBe(sha256(fresh1));
  });
});
