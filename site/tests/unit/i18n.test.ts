import { describe, expect, it } from 'vitest';
import { isLocale, localePath, localeStaticPaths, t } from '../../src/i18n';

describe('t', () => {
  it('looks up nested keys', () => {
    expect(t('en', 'nav.manifesto')).toBe('Manifesto');
  });

  it('interpolates variables', () => {
    expect(t('en', 'home.version', { version: '0.1' })).toBe('Version 0.1');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(t('en', 'home.version')).toBe('Version {version}');
  });

  it('throws on a missing key', () => {
    expect(() => t('en', 'nav.doesNotExist')).toThrow('Missing translation "nav.doesNotExist"');
  });

  it('throws when the key points to a group, not a string', () => {
    expect(() => t('en', 'nav')).toThrow('Missing translation "nav"');
  });
});

describe('isLocale', () => {
  it('accepts supported locales only', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('localePath', () => {
  it('builds prefixed paths', () => {
    expect(localePath('en')).toBe('/en/');
    expect(localePath('en', '/manifesto')).toBe('/en/manifesto');
  });
});

describe('localeStaticPaths', () => {
  it('lists one entry per locale', () => {
    expect(localeStaticPaths()).toEqual([{ params: { lang: 'en' } }]);
  });
});
