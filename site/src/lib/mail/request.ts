import type { Db } from '../db';
import { createToken, type TokenPurpose, tokenCreatedSince } from '../tokens';
import { enqueueMail, type OutgoingMail, queueIsFull } from './queue';

/** At most one link mail per address and purpose in this time. */
export const COOLDOWN_MS = 15 * 60 * 1000;

export interface LinkMailRequest {
  purpose: TokenPurpose;
  payload: { emailHash: string };
  /** Builds the mail around the raw token. */
  build: (token: string) => OutgoingMail;
  /** `false` creates nothing (e.g. withdrawing an address that never signed). Default `true`. */
  send?: boolean;
}

/**
 * - `busy`: the queue is over its cap; nothing was created and the form should say so.
 * - `skipped`: nothing was created (cooldown, or `send: false`); answer as if it was queued.
 * - `queued`: a token was created and its mail queued.
 *
 * Callers answer `skipped` and `queued` identically, so the answer reveals neither the
 * cooldown nor whether an address has signed.
 */
export type LinkMailResult = 'busy' | 'skipped' | 'queued';

export function requestLinkMail(
  db: Db,
  request: LinkMailRequest,
  now: number = Date.now(),
): LinkMailResult {
  // Immediate, so two requests for the same address cannot both pass the cooldown check.
  return db.transaction(
    (tx) => {
      if (queueIsFull(tx)) return 'busy';
      if (request.send === false) return 'skipped';
      const { purpose, payload } = request;
      if (tokenCreatedSince(tx, purpose, payload.emailHash, now - COOLDOWN_MS)) return 'skipped';
      const token = createToken(tx, purpose, payload, now);
      enqueueMail(tx, request.build(token), now);
      return 'queued';
    },
    { behavior: 'immediate' },
  );
}
