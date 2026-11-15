import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type Db, openDb } from '../../src/lib/db';
import { emailTokens, mailQueue } from '../../src/lib/db/schema';
import { enqueueMail, QUEUE_CAP } from '../../src/lib/mail/queue';
import { COOLDOWN_MS, type LinkMailRequest, requestLinkMail } from '../../src/lib/mail/request';

const opened: Db[] = [];
const open = () => {
  const db = openDb(mkdtempSync(join(tmpdir(), 'gm-request-')));
  opened.push(db);
  return db;
};
afterEach(() => {
  for (const db of opened.splice(0)) db.$client.close();
});

const NOW = 1_000_000_000_000;
const tokens = (db: Db) => db.select().from(emailTokens).all();
const mails = (db: Db) => db.select().from(mailQueue).all();
const build = (token: string) => ({ to: 'a@x.de', subject: 's', text: token, html: token });
const request = (db: Db, now: number, overrides: Partial<LinkMailRequest> = {}) =>
  requestLinkMail(db, { purpose: 'sign', payload: { emailHash: 'h1' }, build, ...overrides }, now);

describe('requestLinkMail', () => {
  it('creates a token with the email hash and queues the mail with its link', () => {
    const db = open();
    expect(request(db, NOW)).toBe('queued');
    const [token] = tokens(db);
    expect(token.emailHash).toBe('h1');
    expect(token.purpose).toBe('sign');
    const [mail] = mails(db);
    expect(mail.to).toBe('a@x.de');
    expect(mail.text).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('skips token and mail for a second request within 15 minutes', () => {
    const db = open();
    expect(COOLDOWN_MS).toBe(15 * 60_000);
    request(db, NOW);
    expect(request(db, NOW + COOLDOWN_MS - 1)).toBe('skipped');
    expect(tokens(db)).toHaveLength(1);
    expect(mails(db)).toHaveLength(1);
  });

  it('allows the next request after 15 minutes', () => {
    const db = open();
    request(db, NOW);
    expect(request(db, NOW + COOLDOWN_MS + 1)).toBe('queued');
    expect(tokens(db)).toHaveLength(2);
    expect(mails(db)).toHaveLength(2);
  });

  it('keeps the cooldown per purpose and per address', () => {
    const db = open();
    request(db, NOW);
    expect(request(db, NOW + 1, { purpose: 'withdraw' })).toBe('queued');
    expect(request(db, NOW + 2, { payload: { emailHash: 'h2' } })).toBe('queued');
    expect(request(db, NOW + 3, { purpose: 'withdraw' })).toBe('skipped');
    expect(tokens(db)).toHaveLength(3);
  });

  it('creates nothing when told not to send', () => {
    const db = open();
    expect(request(db, NOW, { send: false })).toBe('skipped');
    expect(tokens(db)).toHaveLength(0);
    expect(mails(db)).toHaveLength(0);
  });

  it('answers "busy" and creates nothing when the queue holds more than 500 rows', () => {
    const db = open();
    expect(QUEUE_CAP).toBe(500);
    const mail = { to: 'q@x.de', subject: 's', text: 't', html: 'h' };
    for (let i = 0; i < QUEUE_CAP; i++) enqueueMail(db, mail, NOW);
    // 500 rows is still within the cap.
    expect(request(db, NOW)).toBe('queued');
    expect(request(db, NOW, { payload: { emailHash: 'h2' } })).toBe('busy');
    // "Busy" comes first, also for a request that would send nothing.
    expect(request(db, NOW, { payload: { emailHash: 'h3' }, send: false })).toBe('busy');
    expect(tokens(db)).toHaveLength(1);
    expect(mails(db)).toHaveLength(QUEUE_CAP + 1);
  });
});
