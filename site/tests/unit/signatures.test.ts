import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { type Db, openDb } from '../../src/lib/db';
import { signatures } from '../../src/lib/db/schema';
import {
  countSignatures,
  createEmailSignature,
  deleteSignature,
  findByEmailHash,
  listSignatures,
  type PendingEmailSignature,
} from '../../src/lib/signatures';

const opened: Db[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.$client.close();
});
const fresh = () => {
  const db = openDb(mkdtempSync(join(tmpdir(), 'gm-signatures-')));
  opened.push(db);
  return db;
};

const pending = (overrides: Partial<PendingEmailSignature> = {}): PendingEmailSignature => ({
  displayName: 'Ada Lovelace',
  affiliation: '',
  country: '',
  emailHash: 'a'.repeat(64),
  manifestoVersion: '0.1',
  consentAt: 500,
  ...overrides,
});

describe('createEmailSignature', () => {
  it('stores the signature with the email hash as provider subject', () => {
    const db = fresh();
    const result = createEmailSignature(db, pending({ country: 'GB' }), 1000);
    expect(result.created).toBe(true);
    const rows = db.select().from(signatures).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: 'email',
      providerSubject: 'a'.repeat(64),
      displayName: 'Ada Lovelace',
      country: 'GB',
      manifestoVersion: '0.1',
      consentAt: 500,
      createdAt: 1000,
      hidden: false,
    });
  });

  it('returns the existing id for a second signature with the same email hash', () => {
    const db = fresh();
    const first = createEmailSignature(db, pending(), 1000);
    const second = createEmailSignature(db, pending({ displayName: 'Someone else' }), 2000);
    expect(first.created).toBe(true);
    if (!first.created) return;
    expect(second).toEqual({ created: false, existingId: first.id });
    expect(db.select().from(signatures).all()).toHaveLength(1);
  });
});

describe('findByEmailHash and deleteSignature', () => {
  it('finds a signature by email hash and deletes it by id', () => {
    const db = fresh();
    createEmailSignature(db, pending({ affiliation: 'Engines' }), 1000);
    const found = findByEmailHash(db, 'a'.repeat(64));
    expect(found).toMatchObject({
      displayName: 'Ada Lovelace',
      affiliation: 'Engines',
      country: null,
      provider: 'email',
      profileUrl: null,
      createdAt: 1000,
    });
    expect(findByEmailHash(db, 'b'.repeat(64))).toBeUndefined();
    if (!found) return;
    deleteSignature(db, found.id);
    expect(findByEmailHash(db, 'a'.repeat(64))).toBeUndefined();
  });
});

describe('countSignatures and listSignatures', () => {
  function seed(db: Db) {
    ['First', 'Second', 'Hidden', 'Third'].forEach((name, i) => {
      createEmailSignature(db, pending({ displayName: name, emailHash: String(i) }), 1000 + i);
    });
    db.update(signatures).set({ hidden: true }).where(eq(signatures.displayName, 'Hidden')).run();
  }

  const names = (db: Db, query: string) =>
    listSignatures(db, { query, page: 1, pageSize: 10 }).items.map((s) => s.displayName);

  it('skip hidden signatures', () => {
    const db = fresh();
    seed(db);
    expect(countSignatures(db)).toBe(3);
    const { items, total } = listSignatures(db, { page: 1, pageSize: 10 });
    expect(total).toBe(3);
    expect(items.map((s) => s.displayName)).not.toContain('Hidden');
  });

  it('list newest first, page by page', () => {
    const db = fresh();
    seed(db);
    expect(listSignatures(db, { page: 1, pageSize: 2 })).toMatchObject({
      total: 3,
      items: [{ displayName: 'Third' }, { displayName: 'Second' }],
    });
    expect(listSignatures(db, { page: 2, pageSize: 2 }).items.map((s) => s.displayName)).toEqual([
      'First',
    ]);
    expect(listSignatures(db, { page: 3, pageSize: 2 }).items).toEqual([]);
  });

  it('match the query against name or affiliation, case-insensitively', () => {
    const db = fresh();
    createEmailSignature(db, pending({ displayName: 'Grace', emailHash: '1' }), 1);
    createEmailSignature(
      db,
      pending({ displayName: 'Ada', affiliation: 'Navy', emailHash: '2' }),
      2,
    );
    createEmailSignature(db, pending({ displayName: 'Alan', emailHash: '3' }), 3);
    expect(names(db, 'grace')).toEqual(['Grace']);
    expect(names(db, 'navy')).toEqual(['Ada']);
    expect(listSignatures(db, { query: 'a', page: 1, pageSize: 10 }).total).toBe(3);
  });

  it('treat % and _ in the query literally', () => {
    const db = fresh();
    createEmailSignature(db, pending({ displayName: 'Up 50% faster', emailHash: '1' }), 1);
    createEmailSignature(db, pending({ displayName: 'Up 500 faster', emailHash: '2' }), 2);
    createEmailSignature(db, pending({ displayName: 'snake_case', emailHash: '3' }), 3);
    createEmailSignature(db, pending({ displayName: 'snakeXcase', emailHash: '4' }), 4);
    expect(names(db, '50%')).toEqual(['Up 50% faster']);
    expect(names(db, 'snake_case')).toEqual(['snake_case']);
    expect(names(db, '\\')).toEqual([]);
  });
});
