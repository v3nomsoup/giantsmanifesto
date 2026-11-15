import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, countryName, countryOptions } from '../../src/lib/countries';

describe('COUNTRY_CODES', () => {
  it('has the 249 assigned ISO 3166-1 alpha-2 codes, each unique', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(249);
    for (const code of COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it('has a display name for every code', () => {
    for (const code of COUNTRY_CODES) expect(countryName(code, 'en')).not.toBe(code);
  });
});

describe('countryName', () => {
  it('names a country in the given language', () => {
    expect(countryName('DE', 'en')).toBe('Germany');
  });
});

describe('countryOptions', () => {
  it('lists every code once, sorted by name', () => {
    const options = countryOptions('en');
    expect(options).toHaveLength(249);
    expect(options[0].name.localeCompare(options[1].name, 'en')).toBeLessThan(0);
    for (let i = 1; i < options.length; i++) {
      expect(options[i - 1].name.localeCompare(options[i].name, 'en')).toBeLessThanOrEqual(0);
    }
    expect(options.find((o) => o.code === 'DE')?.name).toBe('Germany');
  });
});
