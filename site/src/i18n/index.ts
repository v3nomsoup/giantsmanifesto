import en from './en.json';

export const locales = ['en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

type Dictionary = { [key: string]: string | Dictionary };
const dictionaries: Record<Locale, Dictionary> = { en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/** Looks up a dot-path key and fills `{name}` placeholders; throws so typos fail the build. */
export function t(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  let node: string | Dictionary | undefined = dictionaries[locale];
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') {
    throw new Error(`Missing translation "${key}" for locale "${locale}"`);
  }
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function localePath(locale: Locale, path = '/'): string {
  return `/${locale}${path}`;
}

export function localeStaticPaths() {
  return locales.map((lang) => ({ params: { lang } }));
}
