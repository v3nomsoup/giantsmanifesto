import type { Config } from '../config';
import type { Db } from '../db';
import { processQueue, type SendFn } from './queue';

export const WORKER_INTERVAL_MS = 30_000;

/** Runs the queue every 30 seconds; a tick is skipped while the previous run is still going. */
export function startMailWorker(db: Db, send: SendFn, config: Config): () => void {
  const sentTimestamps: number[] = [];
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processQueue(db, send, {
        now: Date.now(),
        maxPerHour: config.mailMaxPerHour,
        sentTimestamps,
      });
    } catch (error) {
      console.error(`mail: worker run failed (${error instanceof Error ? error.name : 'error'})`);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void tick(), WORKER_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
