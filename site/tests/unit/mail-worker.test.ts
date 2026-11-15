import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../../src/lib/config';
import { type Db, openDb } from '../../src/lib/db';
import { enqueueMail } from '../../src/lib/mail/queue';
import { startMailWorker, WORKER_INTERVAL_MS } from '../../src/lib/mail/worker';

let db: Db | undefined;
afterEach(() => {
  vi.useRealTimers();
  db?.$client.close();
  db = undefined;
});

describe('startMailWorker', () => {
  it('does not start a second run while a send hangs', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    db = openDb(mkdtempSync(join(tmpdir(), 'gm-worker-')));
    enqueueMail(db, { to: 'a@x.de', subject: 's', text: 't', html: 'h' }, Date.now());
    const send = vi.fn(() => new Promise<void>(() => {}));
    const stop = startMailWorker(db, send, readConfig({}));
    await vi.advanceTimersByTimeAsync(90_000);
    expect(90_000 / WORKER_INTERVAL_MS).toBe(3);
    expect(send).toHaveBeenCalledTimes(1);
    stop();
  });
});
