import { and, count, desc, eq, or, type SQL, sql } from 'drizzle-orm';
import type { Db } from './db';
import { signatures } from './db/schema';

export interface PublicSignature {
  id: number;
  displayName: string;
  affiliation: string | null;
  country: string | null;
  provider: string;
  profileUrl: string | null;
  createdAt: number;
}

/** Payload of a `sign` email token: everything needed to create the signature on confirm. */
export interface PendingEmailSignature {
  displayName: string;
  affiliation: string;
  country: string;
  emailHash: string;
  manifestoVersion: string;
  consentAt: number;
}

export const EMAIL_PROVIDER = 'email';

type Row = typeof signatures.$inferSelect;

const toPublic = (row: Row): PublicSignature => ({
  id: row.id,
  displayName: row.displayName,
  affiliation: row.affiliation || null,
  country: row.country || null,
  provider: row.provider,
  profileUrl: row.profileUrl || null,
  createdAt: row.createdAt,
});

const byEmailHash = (emailHash: string) =>
  and(eq(signatures.provider, EMAIL_PROVIDER), eq(signatures.providerSubject, emailHash));

/**
 * Creates the signature unless one exists for the same email hash. The unique index on
 * (provider, provider_subject) decides, so two confirmations racing cannot both insert.
 */
export function createEmailSignature(
  db: Db,
  pending: PendingEmailSignature,
  now: number = Date.now(),
): { created: true; id: number } | { created: false; existingId: number } {
  const inserted = db
    .insert(signatures)
    .values({
      createdAt: now,
      displayName: pending.displayName,
      affiliation: pending.affiliation,
      country: pending.country,
      provider: EMAIL_PROVIDER,
      providerSubject: pending.emailHash,
      manifestoVersion: pending.manifestoVersion,
      consentAt: pending.consentAt,
    })
    .onConflictDoNothing()
    .returning({ id: signatures.id })
    .get();
  if (inserted) return { created: true, id: inserted.id };
  const existing = db
    .select({ id: signatures.id })
    .from(signatures)
    .where(byEmailHash(pending.emailHash))
    .get();
  if (!existing) throw new Error('signature insert was skipped but no existing row was found');
  return { created: false, existingId: existing.id };
}

/** Includes hidden signatures: their owners can still find and withdraw them. */
export function findByEmailHash(db: Db, emailHash: string): PublicSignature | undefined {
  const row = db.select().from(signatures).where(byEmailHash(emailHash)).get();
  return row && toPublic(row);
}

export function deleteSignature(db: Db, id: number): void {
  db.delete(signatures).where(eq(signatures.id, id)).run();
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

function visible(query?: string): SQL | undefined {
  const notHidden = eq(signatures.hidden, false);
  const trimmed = query?.trim();
  if (!trimmed) return notHidden;
  const pattern = `%${escapeLike(trimmed)}%`;
  return and(
    notHidden,
    or(
      sql`${signatures.displayName} like ${pattern} escape '\\'`,
      sql`${signatures.affiliation} like ${pattern} escape '\\'`,
    ),
  );
}

export function countSignatures(db: Db): number {
  return db.select({ n: count() }).from(signatures).where(visible()).get()?.n ?? 0;
}

/** Newest first. `page` starts at 1. */
export function listSignatures(
  db: Db,
  opts: { query?: string; page: number; pageSize: number },
): { items: PublicSignature[]; total: number } {
  const where = visible(opts.query);
  const total = db.select({ n: count() }).from(signatures).where(where).get()?.n ?? 0;
  const page = Math.max(1, Math.floor(opts.page));
  const rows = db
    .select()
    .from(signatures)
    .where(where)
    .orderBy(desc(signatures.createdAt), desc(signatures.id))
    .limit(opts.pageSize)
    .offset((page - 1) * opts.pageSize)
    .all();
  return { items: rows.map(toPublic), total };
}
