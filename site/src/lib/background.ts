import { type Config, readConfig, signingEnabled } from './config';
import { type Db, getDb } from './db';
import { purgeOldMail } from './mail/queue';
import { createSend } from './mail/transport';
import { startMailWorker } from './mail/worker';
import { deleteStaleTokens } from './tokens';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Only the name or code: messages can hold paths or addresses. */
function errorLabel(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && /^[A-Za-z0-9_]+$/.test(code)) return code;
  return error instanceof Error ? error.name : 'error';
}

/** Deletes stale tokens and mail older than 48 hours. Never throws. */
export function runCleanup(db: Db, now: number = Date.now()): void {
  try {
    deleteStaleTokens(db, now);
    purgeOldMail(db, now);
  } catch (error) {
    console.error(`cleanup failed (${errorLabel(error)})`);
  }
}

const defaultStartWorker = (db: Db, config: Config) => {
  startMailWorker(db, createSend(config), config);
};

/**
 * The daily cleanup runs in every mode, so tokens and queued addresses are removed on time
 * even while signing is paused. Only the mail worker needs signing to be enabled.
 */
export function startBackgroundJobs(
  config: Config = readConfig(),
  db: Db = getDb(),
  startWorker: (db: Db, config: Config) => void = defaultStartWorker,
): void {
  if (signingEnabled(config)) startWorker(db, config);
  runCleanup(db);
  setInterval(() => runCleanup(db), DAY_MS).unref();
}

/**
 * Wraps `start` so it runs once. A failed start is logged (name or code only) and retried
 * on the next call instead of failing the request or leaving the jobs off for good.
 */
export function createStarter(start: () => void): () => void {
  let started = false;
  return () => {
    if (started) return;
    started = true;
    try {
      start();
    } catch (error) {
      started = false;
      console.error(`background jobs: start failed (${errorLabel(error)})`);
    }
  };
}
