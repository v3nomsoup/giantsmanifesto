import { createHash } from 'node:crypto';

const MAX_LENGTH = 254;
// local@domain.tld, no whitespace, no extra "@", domain labels non-empty.
const SHAPE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

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
  return email.length <= MAX_LENGTH && SHAPE.test(email);
}
