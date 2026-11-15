import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Db, openDb } from '../../src/lib/db';
import { mailQueue } from '../../src/lib/db/schema';
import {
  enqueueMail,
  MAIL_RETENTION_MS,
  type OutgoingMail,
  processQueue,
  purgeOldMail,
} from '../../src/lib/mail/queue';

const opened: Db[] = [];
const open = () => {
  const db = openDb(mkdtempSync(join(tmpdir(), 'gm-queue-')));
  opened.push(db);
  return db;
};
afterEach(() => {
  for (const db of opened.splice(0)) db.$client.close();
});

const NOW = 1_000_000_000_000;
const MIN = 60_000;
const mail = (to: string): OutgoingMail => ({ to, subject: 's', text: 't', html: 'h' });
const rows = (db: Db) => db.select().from(mailQueue).all();

describe('processQueue', () => {
  it('sends at most maxPerHour and leaves the rest', async () => {
    const db = open();
    for (const to of ['a@x.de', 'b@x.de', 'c@x.de']) enqueueMail(db, mail(to), NOW - 1000);
    const send = vi.fn().mockResolvedValue(undefined);
    const sentTimestamps: number[] = [];
    const result = await processQueue(db, send, { now: NOW, maxPerHour: 2, sentTimestamps });
    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(rows(db)).toHaveLength(1);
    expect(sentTimestamps).toHaveLength(2);
  });

  it('sends oldest first', async () => {
    const db = open();
    enqueueMail(db, mail('late@x.de'), NOW - 10);
    enqueueMail(db, mail('early@x.de'), NOW - 5000);
    const send = vi.fn().mockResolvedValue(undefined);
    await processQueue(db, send, { now: NOW, maxPerHour: 1, sentTimestamps: [] });
    expect(send.mock.calls[0][0].to).toBe('early@x.de');
  });

  it('counts recent sends against the cap and ignores old ones', async () => {
    const db = open();
    enqueueMail(db, mail('a@x.de'), NOW - 1000);
    const send = vi.fn().mockResolvedValue(undefined);
    const recent = [NOW - 10 * MIN, NOW - 10 * MIN];
    const blocked = await processQueue(db, send, {
      now: NOW,
      maxPerHour: 2,
      sentTimestamps: recent,
    });
    expect(blocked).toEqual({ sent: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();

    const old = [NOW - 61 * MIN, NOW - 90 * MIN];
    const result = await processQueue(db, send, { now: NOW, maxPerHour: 2, sentTimestamps: old });
    expect(result.sent).toBe(1);
    expect(old).toEqual([NOW]);
  });

  it('deletes the row after a successful send', async () => {
    const db = open();
    enqueueMail(db, mail('a@x.de'), NOW - 1000);
    await processQueue(db, vi.fn().mockResolvedValue(undefined), {
      now: NOW,
      maxPerHour: 5,
      sentTimestamps: [],
    });
    expect(rows(db)).toHaveLength(0);
  });

  it('backs off after a failure and does not count it as sent', async () => {
    const db = open();
    enqueueMail(db, mail('a@x.de'), NOW - 1000);
    const send = vi.fn().mockRejectedValue(new Error('boom'));
    const sentTimestamps: number[] = [];
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await processQueue(db, send, { now: NOW, maxPerHour: 5, sentTimestamps });
    log.mockRestore();
    expect(result).toEqual({ sent: 0, failed: 1 });
    const [row] = rows(db);
    expect(row.attempts).toBe(1);
    expect(row.sendAfter).toBe(NOW + 2 * MIN);
    expect(sentTimestamps).toEqual([]);
  });

  it('gives up after the 8th failure without logging the address', async () => {
    const db = open();
    enqueueMail(db, mail('secret@x.de'), NOW - 1000);
    const send = vi.fn().mockRejectedValue(new Error('rejected secret@x.de'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let now = NOW;
    for (let i = 0; i < 8; i++) {
      await processQueue(db, send, { now, maxPerHour: 5, sentTimestamps: [] });
      // Exactly the backoff: all 8 attempts fit well inside the 48-hour retention.
      now += 2 ** (i + 1) * MIN;
    }
    expect(rows(db)).toHaveLength(0);
    expect(send).toHaveBeenCalledTimes(8);
    expect(JSON.stringify([...log.mock.calls, ...warn.mock.calls])).not.toContain('secret@x.de');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });

  it('skips mail that is not due yet', async () => {
    const db = open();
    enqueueMail(db, mail('a@x.de'), NOW + MIN);
    const send = vi.fn().mockResolvedValue(undefined);
    const result = await processQueue(db, send, { now: NOW, maxPerHour: 5, sentTimestamps: [] });
    expect(result.sent).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(rows(db)).toHaveLength(1);
  });

  it('drops mail older than 48 hours instead of sending it', async () => {
    const db = open();
    enqueueMail(db, mail('old@x.de'), NOW - MAIL_RETENTION_MS - 1);
    enqueueMail(db, mail('new@x.de'), NOW - 1000);
    const send = vi.fn().mockResolvedValue(undefined);
    await processQueue(db, send, { now: NOW, maxPerHour: 5, sentTimestamps: [] });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe('new@x.de');
    expect(rows(db)).toHaveLength(0);
  });
});

describe('purgeOldMail', () => {
  it('deletes rows older than 48 hours, including ones still retrying', () => {
    const db = open();
    expect(MAIL_RETENTION_MS).toBe(48 * 60 * MIN);
    enqueueMail(db, mail('old@x.de'), NOW - MAIL_RETENTION_MS - 1);
    enqueueMail(db, mail('edge@x.de'), NOW - MAIL_RETENTION_MS);
    enqueueMail(db, mail('new@x.de'), NOW - 1000);
    db.update(mailQueue)
      .set({ attempts: 3, sendAfter: NOW + MIN })
      .run();
    expect(purgeOldMail(db, NOW)).toBe(1);
    expect(rows(db).map((row) => row.to)).toEqual(['edge@x.de', 'new@x.de']);
  });
});
