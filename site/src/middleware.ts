import { defineMiddleware } from 'astro:middleware';
import { readConfig, signingEnabled } from './lib/config';
import { getDb } from './lib/db';
import { createSend } from './lib/mail/transport';
import { startMailWorker } from './lib/mail/worker';
import { deleteStaleTokens } from './lib/tokens';

const DAY_MS = 24 * 60 * 60 * 1000;
let started = false;

function startBackgroundJobs() {
  started = true;
  const config = readConfig();
  if (!signingEnabled(config)) return;
  const db = getDb();
  startMailWorker(db, createSend(config), config);
  const cleanup = () => {
    try {
      deleteStaleTokens(db);
    } catch (error) {
      console.error(`tokens: cleanup failed (${error instanceof Error ? error.name : 'error'})`);
    }
  };
  cleanup();
  setInterval(cleanup, DAY_MS).unref();
}

export const onRequest = defineMiddleware((context, next) => {
  // Prerendering at build time must not start the worker; only live requests do.
  if (!started && !context.isPrerendered) startBackgroundJobs();
  return next();
});
