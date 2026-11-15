import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { type Db, openDb } from '../../src/lib/db';
import { signatures } from '../../src/lib/db/schema';

const opened: Db[] = [];
const open = (dir: string) => {
  const db = openDb(dir);
  opened.push(db);
  return db;
};
afterEach(() => {
  for (const db of opened.splice(0)) db.$client.close();
});

const tmp = () => mkdtempSync(join(tmpdir(), 'gm-db-'));
const row = (subject: string) => ({
  displayName: 'Ada',
  affiliation: '',
  country: '',
  provider: 'email',
  providerSubject: subject,
  profileUrl: '',
  manifestoVersion: '0.1',
  consentAt: 1,
  createdAt: 1,
});

describe('openDb', () => {
  it('creates app.db with the expected tables', () => {
    const dir = tmp();
    open(dir);
    expect(existsSync(join(dir, 'app.db'))).toBe(true);
    const raw = new Database(join(dir, 'app.db'), { readonly: true });
    const names = raw
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((r) => (r as { name: string }).name);
    raw.close();
    expect(names).toEqual(expect.arrayContaining(['signatures', 'email_tokens', 'mail_queue']));
  });

  it('can open the same directory twice', () => {
    const dir = tmp();
    open(dir);
    expect(() => open(dir)).not.toThrow();
  });

  it('rejects a duplicate (provider, provider_subject)', () => {
    const db = open(tmp());
    db.insert(signatures).values(row('abc')).run();
    expect(() => db.insert(signatures).values(row('abc')).run()).toThrow(
      expect.objectContaining({ code: 'SQLITE_CONSTRAINT_UNIQUE' }),
    );
  });
});
