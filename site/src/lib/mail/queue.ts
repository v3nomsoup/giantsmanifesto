import { asc, count, eq, lt, lte } from 'drizzle-orm';
import type { Db } from '../db';
import { mailQueue } from '../db/schema';
import type { Tx } from '../tokens';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendFn = (mail: OutgoingMail) => Promise<void>;

export const MAX_ATTEMPTS = 8;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
/** Links in queued mail are dead after 48 hours, so older rows (and their address) go. */
export const MAIL_RETENTION_MS = 48 * HOUR_MS;
/** Above this many queued rows, forms stop accepting requests that would add mail. */
export const QUEUE_CAP = 500;

export function enqueueMail(db: Db | Tx, mail: OutgoingMail, now: number = Date.now()): void {
  db.insert(mailQueue)
    .values({
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      sendAfter: now,
      createdAt: now,
    })
    .run();
}

/** Deletes rows created more than 48 hours ago, sent or not. Returns the number removed. */
export function purgeOldMail(db: Db, now: number = Date.now()): number {
  return db
    .delete(mailQueue)
    .where(lt(mailQueue.createdAt, now - MAIL_RETENTION_MS))
    .run().changes;
}

/** Whether the queue holds more than `QUEUE_CAP` rows. */
export function queueIsFull(db: Db | Tx): boolean {
  const n = db.select({ n: count() }).from(mailQueue).get()?.n ?? 0;
  return n > QUEUE_CAP;
}

/** Only an error code is logged: messages from SMTP servers can echo the recipient. */
function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /^[A-Za-z0-9_]+$/.test(code) ? code : 'unknown';
}

/**
 * Sends due mail, oldest first, within the hourly cap. Callers must not run it concurrently
 * (the worker skips a tick while a run is in progress). `sentTimestamps` is updated in place.
 */
export async function processQueue(
  db: Db,
  send: SendFn,
  opts: { now: number; maxPerHour: number; sentTimestamps: number[] },
): Promise<{ sent: number; failed: number }> {
  const { now, maxPerHour, sentTimestamps } = opts;
  purgeOldMail(db, now);
  const recent = sentTimestamps.filter((at) => at > now - HOUR_MS);
  sentTimestamps.splice(0, sentTimestamps.length, ...recent);

  const budget = maxPerHour - sentTimestamps.length;
  if (budget <= 0) return { sent: 0, failed: 0 };

  const due = db
    .select()
    .from(mailQueue)
    .where(lte(mailQueue.sendAfter, now))
    .orderBy(asc(mailQueue.sendAfter), asc(mailQueue.id))
    .limit(budget)
    .all();

  let sent = 0;
  let failed = 0;
  for (const row of due) {
    try {
      await send({ to: row.to, subject: row.subject, text: row.text, html: row.html });
    } catch (error) {
      failed++;
      const attempts = row.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        db.delete(mailQueue).where(eq(mailQueue.id, row.id)).run();
        console.error(`mail: giving up after ${attempts} attempts (${errorCode(error)})`);
      } else {
        db.update(mailQueue)
          .set({ attempts, sendAfter: now + 2 ** attempts * MINUTE_MS })
          .where(eq(mailQueue.id, row.id))
          .run();
        console.error(`mail: send failed, attempt ${attempts} (${errorCode(error)})`);
      }
      continue;
    }
    db.delete(mailQueue).where(eq(mailQueue.id, row.id)).run();
    sentTimestamps.push(now);
    sent++;
  }
  return { sent, failed };
}
