import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStarter, startBackgroundJobs } from '../../src/lib/background';
import { readConfig } from '../../src/lib/config';
import { type Db, openDb } from '../../src/lib/db';
import { emailTokens, mailQueue } from '../../src/lib/db/schema';
import { enqueueMail, MAIL_RETENTION_MS } from '../../src/lib/mail/queue';
import { createToken, TOKEN_TTL_MS } from '../../src/lib/tokens';

const opened: Db[] = [];
const open = () => {
  const db = openDb(mkdtempSync(join(tmpdir(), 'gm-jobs-')));
  opened.push(db);
  return db;
};
afterEach(() => {
  for (const db of opened.splice(0)) db.$client.close();
  vi.restoreAllMocks();
});

describe('createStarter', () => {
  it('starts once and never again after success', () => {
    const start = vi.fn();
    const ensure = createStarter(start);
    ensure();
    ensure();
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('logs only the error name or code on failure and retries on the next call', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const start = vi
      .fn()
      .mockImplementationOnce(() => {
        throw Object.assign(new Error('cannot open /data/app.db for a@b.de'), { code: 'EACCES' });
      })
      .mockImplementationOnce(() => {
        throw new TypeError('secret detail');
      })
      .mockImplementation(() => {});
    const ensure = createStarter(start);
    expect(() => ensure()).not.toThrow();
    ensure();
    ensure();
    ensure();
    expect(start).toHaveBeenCalledTimes(3);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain('EACCES');
    expect(logged).toContain('TypeError');
    expect(logged).not.toContain('a@b.de');
    expect(logged).not.toContain('secret detail');
  });
});

describe('startBackgroundJobs', () => {
  const NOW = Date.now();
  const seed = (db: Db) => {
    createToken(db, 'sign', { emailHash: 'h' }, NOW - TOKEN_TTL_MS - 1000);
    enqueueMail(
      db,
      { to: 'a@x.de', subject: 's', text: 't', html: 'h' },
      NOW - MAIL_RETENTION_MS - 1000,
    );
  };

  it('runs the cleanup but not the mail worker while signing is paused', () => {
    vi.spyOn(globalThis, 'setInterval').mockReturnValue({ unref() {} } as never);
    const db = open();
    seed(db);
    const startWorker = vi.fn();
    startBackgroundJobs(readConfig({}), db, startWorker);
    expect(startWorker).not.toHaveBeenCalled();
    expect(db.select().from(emailTokens).all()).toHaveLength(0);
    expect(db.select().from(mailQueue).all()).toHaveLength(0);
  });

  it('starts the mail worker and the cleanup when signing is enabled', () => {
    vi.spyOn(globalThis, 'setInterval').mockReturnValue({ unref() {} } as never);
    const db = open();
    seed(db);
    const startWorker = vi.fn();
    const config = readConfig({
      SMTP_HOST: 'mail.test',
      MAIL_FROM: 'a@b.test',
      SESSION_SECRET: 's',
    });
    startBackgroundJobs(config, db, startWorker);
    expect(startWorker).toHaveBeenCalledWith(db, config);
    expect(db.select().from(emailTokens).all()).toHaveLength(0);
    expect(db.select().from(mailQueue).all()).toHaveLength(0);
  });
});
