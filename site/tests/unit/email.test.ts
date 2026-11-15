import { describe, expect, it } from 'vitest';
import { hashEmail, isValidEmail, normalizeEmail } from '../../src/lib/email';

describe('normalizeEmail', () => {
  it('trims and lowercases the whole address', () => {
    expect(normalizeEmail('  Ada@Example.ORG ')).toBe('ada@example.org');
  });
});

describe('hashEmail', () => {
  it('hashes both spellings of an address to the same 64 hex characters', () => {
    const a = hashEmail('  Ada@Example.ORG ');
    const b = hashEmail('ada@example.org');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different addresses', () => {
    expect(hashEmail('ada@example.org')).not.toBe(hashEmail('bob@example.org'));
  });
});

describe('isValidEmail', () => {
  it.each(['', 'a@b', 'a b@c.de', '@c.de', 'a@', 'a@@c.de', 'a@c .de'])('rejects %j', (raw) => {
    expect(isValidEmail(raw)).toBe(false);
  });

  it('rejects a 255-character address', () => {
    const raw = `${'a'.repeat(250)}@b.de`;
    expect(raw).toHaveLength(255);
    expect(isValidEmail(raw)).toBe(false);
  });

  it.each([
    'root,x@y.org',
    'a;b@y.org',
    'a<b@y.org',
    'a>b@y.org',
    'a(b@y.org',
    'a)b@y.org',
    'a[b@y.org',
    'a]b@y.org',
    'a"b@y.org',
    'a:b@y.org',
    'a\\b@y.org',
  ])('rejects the header-unsafe local part %j', (raw) => {
    expect(isValidEmail(raw)).toBe(false);
  });

  it.each(['a@x,evil.org', 'a@x;evil.org', 'a@x>.org'])(
    'rejects the header-unsafe domain %j',
    (raw) => {
      expect(isValidEmail(raw)).toBe(false);
    },
  );

  it('accepts a plus-tagged subdomain address', () => {
    expect(isValidEmail('a.b+tag@sub.example.co.uk')).toBe(true);
  });
});
