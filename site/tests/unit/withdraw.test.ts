import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type Db, openDb } from '../../src/lib/db';
import { createEmailSignature, findByEmailHash } from '../../src/lib/signatures';
import { createToken, peekToken } from '../../src/lib/tokens';
import { withdrawByToken } from '../../src/lib/withdraw';

const opened: Db[] = [];
const open = () => {
  const db = openDb(mkdtempSync(join(tmpdir(), 'withdraw-')));
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

describe('withdrawByToken', () => {
  it('consumes the token and deletes the signature together', () => {
    const db = open();
    createEmailSignature(db, pending('h1'));
    const raw = createToken(db, 'withdraw', { emailHash: 'h1' });
    expect(withdrawByToken(db, raw)).toEqual({ ok: true, deleted: true });
    expect(findByEmailHash(db, 'h1')).toBeUndefined();
    expect(peekToken(db, raw, 'withdraw')).toEqual({ ok: false, reason: 'used' });
  });

  it('reports a valid token whose signature is already gone', () => {
    const db = open();
    const raw = createToken(db, 'withdraw', { emailHash: 'nobody' });
    expect(withdrawByToken(db, raw)).toEqual({ ok: true, deleted: false });
  });

  it('refuses a used, unknown or wrong-purpose token and deletes nothing', () => {
    const db = open();
    createEmailSignature(db, pending('h2'));
    const raw = createToken(db, 'withdraw', { emailHash: 'h2' });
    withdrawByToken(db, raw);
    createEmailSignature(db, pending('h2'));
    expect(withdrawByToken(db, raw)).toEqual({ ok: false, reason: 'used' });
    expect(withdrawByToken(db, 'nope')).toEqual({ ok: false, reason: 'invalid' });
    const sign = createToken(db, 'sign', { emailHash: 'h2' });
    expect(withdrawByToken(db, sign)).toEqual({ ok: false, reason: 'invalid' });
    expect(findByEmailHash(db, 'h2')).toBeDefined();
  });

  it('rolls the token back when the delete fails', () => {
    const db = open();
    createEmailSignature(db, pending('h3'));
    const raw = createToken(db, 'withdraw', { emailHash: 'h3' });
    db.$client.exec(
      `create trigger no_delete before delete on signatures begin select raise(abort, 'boom'); end`,
    );
    expect(() => withdrawByToken(db, raw)).toThrow('boom');
    expect(peekToken(db, raw, 'withdraw').ok).toBe(true);
    expect(findByEmailHash(db, 'h3')).toBeDefined();
  });
});
