import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type Db, openDb } from '../../src/lib/db';
import { signByToken } from '../../src/lib/sign';
import { createEmailSignature, findByEmailHash } from '../../src/lib/signatures';
import { createToken, peekToken } from '../../src/lib/tokens';

const opened: Db[] = [];
const open = () => {
  const db = openDb(mkdtempSync(join(tmpdir(), 'sign-')));
  opened.push(db);
  return db;
};
afterEach(() => {
  for (const db of opened.splice(0)) db.$client.close();
});

const pending = (emailHash: string) => ({
  displayName: 'Ada',
  affiliation: '',
  country: '',
  emailHash,
  manifestoVersion: '1',
  consentAt: 1,
});

describe('signByToken', () => {
  it('consumes the token and creates the signature together', () => {
    const db = open();
    const raw = createToken(db, 'sign', pending('h1'));
    const result = signByToken(db, raw);
    const created = findByEmailHash(db, 'h1');
    expect(created).toBeDefined();
    expect(result).toEqual({ ok: true, created: true, id: created?.id });
    expect(peekToken(db, raw, 'sign')).toEqual({ ok: false, reason: 'used' });
  });

  it('reports an existing signature for the same address', () => {
    const db = open();
    const first = createEmailSignature(db, pending('h2'));
    const raw = createToken(db, 'sign', pending('h2'));
    expect(first.created).toBe(true);
    expect(signByToken(db, raw)).toEqual({
      ok: true,
      created: false,
      existingId: first.created ? first.id : -1,
    });
  });

  it('refuses a used, unknown or wrong-purpose token and creates nothing', () => {
    const db = open();
    const raw = createToken(db, 'sign', pending('h3'));
    signByToken(db, raw);
    expect(signByToken(db, raw)).toEqual({ ok: false, reason: 'used' });
    expect(signByToken(db, 'nope')).toEqual({ ok: false, reason: 'invalid' });
    const withdraw = createToken(db, 'withdraw', { emailHash: 'h4' });
    expect(signByToken(db, withdraw)).toEqual({ ok: false, reason: 'invalid' });
    expect(findByEmailHash(db, 'h4')).toBeUndefined();
  });

  it('rolls the token back when the insert fails', () => {
    const db = open();
    const raw = createToken(db, 'sign', pending('h5'));
    db.$client.exec(
      `create trigger no_insert before insert on signatures begin select raise(abort, 'boom'); end`,
    );
    expect(() => signByToken(db, raw)).toThrow('boom');
    expect(peekToken(db, raw, 'sign').ok).toBe(true);
    expect(findByEmailHash(db, 'h5')).toBeUndefined();
  });
});
