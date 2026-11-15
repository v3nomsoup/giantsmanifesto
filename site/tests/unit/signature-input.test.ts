import { describe, expect, it } from 'vitest';
import { parseSignatureForm } from '../../src/lib/forms/signature-input';

function form(overrides: Record<string, string | undefined> = {}): FormData {
  const values: Record<string, string | undefined> = {
    displayName: '  Ada Lovelace ',
    affiliation: ' Analytical Engines ',
    country: 'GB',
    email: ' Ada@Example.org ',
    consent: 'on',
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}

describe('parseSignatureForm', () => {
  it('accepts valid input and trims every field', () => {
    expect(parseSignatureForm(form())).toEqual({
      ok: true,
      value: {
        displayName: 'Ada Lovelace',
        affiliation: 'Analytical Engines',
        country: 'GB',
        email: 'Ada@Example.org',
        consent: true,
      },
    });
  });

  it('accepts empty affiliation and country', () => {
    const result = parseSignatureForm(form({ affiliation: '', country: undefined }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.affiliation).toBe('');
      expect(result.value.country).toBe('');
    }
  });

  it.each([
    ['an empty name', { displayName: '' }, 'displayName', 'form.errors.nameRequired'],
    ['a name of only spaces', { displayName: '    ' }, 'displayName', 'form.errors.nameRequired'],
    [
      'an 81-character name',
      { displayName: 'a'.repeat(81) },
      'displayName',
      'form.errors.nameTooLong',
    ],
    [
      'a 121-character affiliation',
      { affiliation: 'a'.repeat(121) },
      'affiliation',
      'form.errors.affiliationTooLong',
    ],
    ['an unknown country', { country: 'XX' }, 'country', 'form.errors.countryInvalid'],
    ['an invalid email', { email: 'not-an-email' }, 'email', 'form.errors.emailInvalid'],
    ['an empty email', { email: '' }, 'email', 'form.errors.emailRequired'],
    ['missing consent', { consent: undefined }, 'consent', 'form.errors.consentRequired'],
  ] as const)('reports %s with exactly its error key', (_label, overrides, field, key) => {
    const result = parseSignatureForm(form(overrides));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual({ [field]: key });
  });

  it('accepts a name of exactly 80 characters, counting characters not UTF-16 units', () => {
    expect(parseSignatureForm(form({ displayName: 'a'.repeat(80) })).ok).toBe(true);
    expect(parseSignatureForm(form({ displayName: '😀'.repeat(80) })).ok).toBe(true);
  });

  it('returns the trimmed values alongside the errors', () => {
    const result = parseSignatureForm(form({ email: 'nope' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.values.displayName).toBe('Ada Lovelace');
      expect(result.values.email).toBe('nope');
      expect(result.values.consent).toBe(true);
    }
  });

  it('treats missing fields as empty', () => {
    const result = parseSignatureForm(new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        displayName: 'form.errors.nameRequired',
        email: 'form.errors.emailRequired',
        consent: 'form.errors.consentRequired',
      });
    }
  });
});
