import { createHash } from 'node:crypto';

const MAX_LENGTH = 254;
// local@domain.tld, no whitespace, no extra "@", domain labels non-empty.
const SHAPE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
// Characters that are special in address headers (lists, groups, comments, quoting); an
// address with one could make the mail go to someone else.
const HEADER_SPECIALS = /[,;<>()[\]":\\]/;

/** Trim, then lowercase the whole address. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Hex SHA-256 of the normalized address. The only form of an address we store. */
export function hashEmail(raw: string): string {
  return createHash('sha256').update(normalizeEmail(raw)).digest('hex');
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  // Checked in the whole address: none of these are valid in a domain either.
  return email.length <= MAX_LENGTH && SHAPE.test(email) && !HEADER_SPECIALS.test(email);
}
