# Milestone 1: Foundation & Public Content Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable Astro site that renders the Shoulders of Giants Manifesto from the repo-root Markdown file, with homepage, changelog, contact, privacy and imprint pages under `/en/`, shipped as a Docker image to Coolify through a CI pipeline that deploys only when tests pass.

**Architecture:** One Astro app in `site/` with the Node adapter in standalone mode (`output: 'server'`). Content pages are prerendered at build time from `../Shoulders-of-Giants-Manifesto.md`, `../CHANGELOG.md` and `site/content/legal/*.md`; the server part only serves `/` (redirect) and `/healthz` in this milestone, and later milestones add server-rendered pages. All UI text comes from `site/src/i18n/en.json` through a small `t()` helper.

**Tech Stack:** Node 22, Astro (latest) + `@astrojs/node`, TypeScript (strict), `marked` + `github-slugger`, Vitest, Playwright + `@axe-core/playwright`, Biome, Docker, GitHub Actions, Coolify.

**Spec:** `docs/specs/2026-11-13-giantsmanifesto-website-design.md` · **Roadmap:** `docs/plans/2026-11-13-roadmap.md`

## Global Constraints

- Node 22 everywhere (local, Docker `node:22-bookworm-slim`, CI `node-version: 22`).
- `Shoulders-of-Giants-Manifesto.md` in the repo root is the single source of the manifesto text; never copy it into `site/`.
- The manifesto version is parsed from the `*Version X.Y · …*` line; a missing line must fail the build.
- All public pages live under a language prefix: `/en/…`. `/` redirects to `/en/`. English is the only locale in v1.
- All UI text comes from `site/src/i18n/en.json`; a missing key must throw, not render the key.
- "Who's behind this" lives on the homepage at anchor `#about`; wording is "initiated by … in a personal capacity", linking `https://eckert.rocks` and `https://computerkunst.info`.
- Contact address: `contact@giantsmanifesto.org`. GitHub repo: `https://github.com/v3nomsoup/giantsmanifesto`.
- No cookies, analytics or third-party requests (no external fonts, scripts or images).
- Container listens on port 3000 and exposes `/healthz`.
- Secrets never go into the repo; CI reads `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN` from GitHub secrets.
- Commits: short imperative subject (e.g. `Add manifesto page`). **No `Co-Authored-By` trailer and no Claude attribution.** The repo-local git identity is already set; don't change it.
- All commands run from `site/` unless a step says otherwise.

## Review Focus

1. **Manifesto file edited without a version line** → the build must fail with a message naming the file, not publish "Version undefined". (Task 3, `throws when the version line is missing`)
2. **Table-of-contents link points to a missing heading id** (e.g. after a heading is renamed) → every TOC link must resolve to exactly one element. (Task 3 unit test and Task 4 E2E test)
3. **Unknown locale such as `/xx/manifesto` or `/de/`** → a 404 page, not a crash or an English page under the wrong URL. (Task 4, `unknown locale returns 404`)
4. **Phone-width screens (375px) and dark mode** → no horizontal scrolling, no contrast violations in either colour scheme. (Task 5, accessibility spec)
5. **Typo in a translation key** → build/test failure instead of a raw key on the page. (Task 2, `throws on a missing key`)

---

## File Structure

```
.dockerignore                         build context filter
.github/workflows/ci.yml              lint, type check, tests, gated deploy
.gitignore                            repo-wide ignores
CHANGELOG.md                          version history of the text
Dockerfile                            multi-stage build of site/
README.md                             what this repo is, how to run it
docs/deploy-coolify.md                one-time Coolify and GitHub setup
site/
  package.json, package-lock.json
  astro.config.mjs                    Node adapter, server output, site URL
  tsconfig.json                       Astro strict preset
  biome.json                          lint/format config
  vitest.config.ts                    unit tests in tests/unit
  playwright.config.ts                E2E tests against the built server
  .gitignore
  public/favicon.svg
  content/legal/privacy.en.md         privacy policy text
  content/legal/imprint.en.md         imprint text
  src/i18n/en.json                    all UI strings
  src/i18n/index.ts                   locales, t(), localePath(), localeStaticPaths()
  src/lib/site.ts                     constants: GitHub URL, contact email
  src/lib/repo-files.ts               reads repo-root and site-local content files
  src/lib/markdown.ts                 Markdown → HTML with heading ids and TOC
  src/lib/manifesto.ts                manifesto title, version, intro, body, TOC
  src/styles/global.css               tokens, light/dark, layout, prose
  src/layouts/Base.astro              html shell, meta, header, footer
  src/components/Header.astro
  src/components/Footer.astro
  src/pages/index.astro               redirect / → /en/
  src/pages/404.astro
  src/pages/healthz.ts
  src/pages/[lang]/index.astro        homepage
  src/pages/[lang]/manifesto.astro
  src/pages/[lang]/changelog.astro
  src/pages/[lang]/contact.astro
  src/pages/[lang]/privacy.astro
  src/pages/[lang]/imprint.astro
  tests/unit/healthz.test.ts
  tests/unit/i18n.test.ts
  tests/unit/markdown.test.ts
  tests/unit/manifesto.test.ts
  tests/e2e/content.spec.ts
  tests/e2e/accessibility.spec.ts
```

---

### Task 1: Scaffold the Astro app with a health endpoint

**Files:**
- Create: `site/package.json`, `site/astro.config.mjs`, `site/tsconfig.json`, `site/vitest.config.ts`, `site/biome.json`, `site/.gitignore`, `site/src/pages/healthz.ts`, `site/tests/unit/healthz.test.ts`, `.gitignore`, `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: npm scripts `dev`, `build`, `start`, `typecheck`, `lint`, `test`, `test:e2e`; `GET /healthz` → `200 ok` (`text/plain`).

- [ ] **Step 1: Create `site/package.json`**

```json
{
  "name": "giantsmanifesto-site",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "start": "node dist/server/entry.mjs",
    "typecheck": "astro check",
    "lint": "biome check src/lib src/i18n tests",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd site
npm install astro @astrojs/node marked github-slugger
npm install -D @astrojs/check typescript vitest @biomejs/biome @playwright/test @axe-core/playwright
```
Expected: `package-lock.json` created, no errors.

- [ ] **Step 3: Create config files**

`site/astro.config.mjs`:
```js
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://giantsmanifesto.org',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
});
```

`site/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`site/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'] },
});
```

`site/.gitignore`:
```
node_modules/
dist/
.astro/
test-results/
playwright-report/
```

Repo-root `.gitignore`:
```
.DS_Store
.env
.env.*
!.env.example
```

- [ ] **Step 4: Generate and adjust the Biome config**

Run: `npx biome init`
Then edit the generated `site/biome.json` so the formatter matches the code in this plan (keep whatever `$schema` and other keys `init` produced):
```json
"formatter": { "enabled": true, "indentStyle": "space", "lineWidth": 100 },
"javascript": { "formatter": { "quoteStyle": "single" } }
```

- [ ] **Step 5: Write the failing test** — `site/tests/unit/healthz.test.ts`

```ts
import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import { GET } from '../../src/pages/healthz';

describe('GET /healthz', () => {
  it('answers 200 with "ok"', async () => {
    const response = await GET({} as APIContext);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot resolve `../../src/pages/healthz`.

- [ ] **Step 7: Implement** — `site/src/pages/healthz.ts`

```ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response('ok', { headers: { 'content-type': 'text/plain' } });
```

- [ ] **Step 8: Run tests, lint, type check and build**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: test PASS; lint and type check report no errors; build writes `dist/server/entry.mjs`.

- [ ] **Step 9: Create repo-root `README.md`**

````markdown
# The Shoulders of Giants Manifesto

Source of [giantsmanifesto.org](https://giantsmanifesto.org).

- `Shoulders-of-Giants-Manifesto.md`: the manifesto text, the single source for the website
- `CHANGELOG.md`: what changed in each version of the text, and why
- `site/`: the website (Astro)
- `docs/`: design spec, implementation plans, operations guides

Feedback on the text is welcome as an issue or pull request.

## Development

```bash
cd site
npm install
npm run dev        # http://localhost:4321
npm test           # unit tests
npm run test:e2e   # browser tests (first run: npx playwright install chromium)
```
````

- [ ] **Step 10: Commit** (from repo root)

```bash
git add .gitignore README.md site
git commit -m "Scaffold Astro site with health endpoint"
```

---

### Task 2: Translation helper and UI strings

**Files:**
- Create: `site/src/i18n/en.json`, `site/src/i18n/index.ts`, `site/src/lib/site.ts`, `site/tests/unit/i18n.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (`src/i18n/index.ts`):
  - `locales: readonly ['en']`, `type Locale = 'en'`, `defaultLocale: Locale`
  - `isLocale(value: unknown): value is Locale`
  - `t(locale: Locale, key: string, vars?: Record<string, string | number>): string` — dot-path lookup, `{name}` interpolation, throws on missing key
  - `localePath(locale: Locale, path?: string): string` — `localePath('en')` → `/en/`, `localePath('en', '/manifesto')` → `/en/manifesto`
  - `localeStaticPaths(): { params: { lang: Locale } }[]`
- Produces (`src/lib/site.ts`): `GITHUB_URL`, `CONTACT_EMAIL`, `INITIATOR_URL`, `COMPUTERKUNST_URL`

- [ ] **Step 1: Write the failing test** — `site/tests/unit/i18n.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n`
Expected: FAIL, cannot resolve `../../src/i18n`.

- [ ] **Step 3: Create `site/src/i18n/en.json`** (all strings needed in this milestone)

```json
{
  "site": {
    "name": "The Shoulders of Giants Manifesto",
    "shortName": "Shoulders of Giants",
    "description": "The machines that will shape our century were built from all of us. They must belong to all of us."
  },
  "a11y": {
    "skip": "Skip to content",
    "mainNav": "Main",
    "footerNav": "Footer",
    "toc": "Contents"
  },
  "nav": {
    "manifesto": "Manifesto",
    "changelog": "Changelog",
    "contact": "Contact"
  },
  "footer": {
    "about": "Who's behind this",
    "contact": "Contact",
    "privacy": "Privacy",
    "imprint": "Imprint",
    "source": "Source on GitHub"
  },
  "home": {
    "readManifesto": "Read the full manifesto",
    "version": "Version {version}",
    "shapeTitle": "Shape it",
    "shapeText": "This is a living document. Criticism, ideas and improvements shape each new version.",
    "shapeLink": "Open an issue or pull request on GitHub",
    "aboutTitle": "Who's behind this",
    "aboutInitiator": "The manifesto was initiated by {name}, AI automation expert and chair of {org}, in a personal capacity.",
    "aboutProcess": "It belongs to everyone who stands behind it. Feedback flows into new versions, and the changelog records what changed and why."
  },
  "manifesto": {
    "title": "Manifesto",
    "version": "Version {version}",
    "shapeText": "Something missing or wrong? Help shape the next version.",
    "shapeLink": "Give feedback on GitHub"
  },
  "changelog": {
    "title": "Changelog"
  },
  "contact": {
    "title": "Contact",
    "intro": "Questions, press enquiries or ideas: write to {email}.",
    "feedback": "Feedback on the text itself is welcome on {github}.",
    "initiator": "Initiated by Philipp Eckert."
  },
  "legal": {
    "privacy": "Privacy policy",
    "imprint": "Imprint"
  },
  "notFound": {
    "title": "Page not found",
    "text": "This page does not exist.",
    "home": "Back to the homepage"
  }
}
```

- [ ] **Step 4: Implement** — `site/src/i18n/index.ts`

```ts
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
```

- [ ] **Step 5: Create `site/src/lib/site.ts`**

```ts
export const GITHUB_URL = 'https://github.com/v3nomsoup/giantsmanifesto';
export const CONTACT_EMAIL = 'contact@giantsmanifesto.org';
export const INITIATOR_URL = 'https://eckert.rocks';
export const COMPUTERKUNST_URL = 'https://computerkunst.info';
```

- [ ] **Step 6: Run tests and lint**

Run: `npm test && npm run lint`
Expected: all PASS, no lint errors.

- [ ] **Step 7: Commit** (from repo root)

```bash
git add site/src/i18n site/src/lib/site.ts site/tests/unit/i18n.test.ts
git commit -m "Add translation helper and English UI strings"
```

---

### Task 3: Markdown rendering and manifesto parsing

**Files:**
- Create: `site/src/lib/repo-files.ts`, `site/src/lib/markdown.ts`, `site/src/lib/manifesto.ts`, `site/tests/unit/markdown.test.ts`, `site/tests/unit/manifesto.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `repo-files.ts`: `repoRoot(): string` (env `CONTENT_DIR` or `<cwd>/..`), `readRepoFile(name: string): string`, `readSiteFile(relativePath: string): string` (relative to `<cwd>`)
  - `markdown.ts`: `interface TocEntry { depth: number; text: string; id: string }`, `interface RenderedMarkdown { html: string; toc: TocEntry[] }`, `renderMarkdown(source: string): RenderedMarkdown`
  - `manifesto.ts`: `MANIFESTO_FILE = 'Shoulders-of-Giants-Manifesto.md'`, `interface Manifesto { title: string; version: string; introHtml: string; html: string; toc: TocEntry[] }`, `parseManifesto(source: string): Manifesto`, `loadManifesto(): Manifesto`

- [ ] **Step 1: Write the failing tests**

`site/tests/unit/markdown.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown';

describe('renderMarkdown', () => {
  it('gives headings slug ids and collects a table of contents', () => {
    const { html, toc } = renderMarkdown('## Call to action\n\n### I. Progress builds\n\nText.');
    expect(html).toContain('<h2 id="call-to-action">Call to action</h2>');
    expect(html).toContain('<h3 id="i-progress-builds">I. Progress builds</h3>');
    expect(toc).toEqual([
      { depth: 2, text: 'Call to action', id: 'call-to-action' },
      { depth: 3, text: 'I. Progress builds', id: 'i-progress-builds' },
    ]);
  });

  it('keeps ids unique when headings repeat', () => {
    const { toc } = renderMarkdown('## Notes\n\n## Notes');
    expect(toc.map((entry) => entry.id)).toEqual(['notes', 'notes-1']);
  });

  it('starts fresh ids on every call', () => {
    renderMarkdown('## Notes');
    expect(renderMarkdown('## Notes').toc[0].id).toBe('notes');
  });

  it('renders inline formatting inside headings', () => {
    const { html } = renderMarkdown('## Sign *it*');
    expect(html).toContain('<h2 id="sign-it">Sign <em>it</em></h2>');
  });
});
```

`site/tests/unit/manifesto.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadManifesto, parseManifesto } from '../../src/lib/manifesto';

const fixture = [
  '# Test Manifesto',
  '',
  '> A quote',
  '',
  'We value:',
  '',
  '- **Common good** over private profit',
  '',
  '## Preamble',
  '',
  'Text.',
  '',
  '### I. First principle',
  '',
  '*Version 1.2 · draft*',
].join('\n');

describe('parseManifesto', () => {
  it('reads title and version', () => {
    const manifesto = parseManifesto(fixture);
    expect(manifesto.title).toBe('Test Manifesto');
    expect(manifesto.version).toBe('1.2');
  });

  it('builds the table of contents without the title', () => {
    expect(parseManifesto(fixture).toc).toEqual([
      { depth: 2, text: 'Preamble', id: 'preamble' },
      { depth: 3, text: 'I. First principle', id: 'i-first-principle' },
    ]);
  });

  it('limits the intro to the text before the first section', () => {
    const { introHtml } = parseManifesto(fixture);
    expect(introHtml).toContain('<strong>Common good</strong>');
    expect(introHtml).not.toContain('Preamble');
  });

  it('leaves the title out of the body', () => {
    expect(parseManifesto(fixture).html).not.toContain('Test Manifesto');
  });

  it('throws when the version line is missing', () => {
    expect(() => parseManifesto(fixture.replace('*Version 1.2 · draft*', ''))).toThrow(
      'Shoulders-of-Giants-Manifesto.md: missing "*Version X.Y" line',
    );
  });

  it('throws when the title is missing', () => {
    expect(() => parseManifesto(fixture.replace('# Test Manifesto', ''))).toThrow(
      'Shoulders-of-Giants-Manifesto.md: missing "# " title line',
    );
  });
});

describe('loadManifesto (real file)', () => {
  const manifesto = loadManifesto();

  it('parses the published manifesto', () => {
    expect(manifesto.title).toBe('The Shoulders of Giants Manifesto');
    expect(manifesto.version).toMatch(/^\d+(\.\d+)+$/);
  });

  it('has a table of contents whose ids all exist in the body', () => {
    expect(manifesto.toc.map((entry) => entry.id)).toContain('preamble');
    for (const entry of manifesto.toc) {
      expect(manifesto.html).toContain(`id="${entry.id}"`);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- markdown manifesto`
Expected: FAIL, cannot resolve `../../src/lib/markdown` and `../../src/lib/manifesto`.

- [ ] **Step 3: Implement `site/src/lib/repo-files.ts`**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** The repo root holds the manifesto and changelog; the Astro app runs from site/. */
export function repoRoot(): string {
  return process.env.CONTENT_DIR ?? path.resolve(process.cwd(), '..');
}

export function readRepoFile(name: string): string {
  return readFileSync(path.join(repoRoot(), name), 'utf8');
}

export function readSiteFile(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}
```

- [ ] **Step 4: Implement `site/src/lib/markdown.ts`**

```ts
import GithubSlugger from 'github-slugger';
import { Marked } from 'marked';

export interface TocEntry {
  depth: number;
  text: string;
  id: string;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
}

/** Renders trusted Markdown from the repo and gives every heading a slug id. */
export function renderMarkdown(source: string): RenderedMarkdown {
  const slugger = new GithubSlugger();
  const toc: TocEntry[] = [];
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth, text }) {
        const id = slugger.slug(text);
        toc.push({ depth, text, id });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
    },
  });
  const html = marked.parse(source, { async: false });
  return { html, toc };
}
```

Note: `text` is the raw heading source, so `## Sign *it*` slugs to `sign-it` (the slugger drops `*`) and the TOC text reads `Sign *it*`. The manifesto's headings contain no inline formatting, so this is acceptable.

- [ ] **Step 5: Implement `site/src/lib/manifesto.ts`**

```ts
import { renderMarkdown, type TocEntry } from './markdown';
import { readRepoFile } from './repo-files';

export const MANIFESTO_FILE = 'Shoulders-of-Giants-Manifesto.md';

export interface Manifesto {
  title: string;
  version: string;
  introHtml: string;
  html: string;
  toc: TocEntry[];
}

export function parseManifesto(source: string): Manifesto {
  const titleMatch = source.match(/^# (.+)$/m);
  if (!titleMatch || titleMatch.index === undefined) {
    throw new Error(`${MANIFESTO_FILE}: missing "# " title line`);
  }
  const versionMatch = source.match(/^\*Version (\d+(?:\.\d+)+)\b/m);
  if (!versionMatch) {
    throw new Error(`${MANIFESTO_FILE}: missing "*Version X.Y" line`);
  }

  const body = source.slice(titleMatch.index + titleMatch[0].length);
  const firstSection = body.search(/^## /m);
  const intro = firstSection === -1 ? body : body.slice(0, firstSection);
  const { html, toc } = renderMarkdown(body);

  return {
    title: titleMatch[1].trim(),
    version: versionMatch[1],
    introHtml: renderMarkdown(intro).html,
    html,
    toc,
  };
}

let cached: Manifesto | undefined;

export function loadManifesto(): Manifesto {
  cached ??= parseManifesto(readRepoFile(MANIFESTO_FILE));
  return cached;
}
```

- [ ] **Step 6: Run tests, lint and type check**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all PASS. If `typecheck` complains about `this` or the `heading` parameter types in `markdown.ts`, check the installed `marked` version's `RendererObject` type and annotate the parameter as `Tokens.Heading` (imported from `marked`); behaviour must not change.

- [ ] **Step 7: Commit** (from repo root)

```bash
git add site/src/lib site/tests/unit
git commit -m "Render manifesto Markdown with heading ids and version"
```

---

### Task 4: Layout, manifesto and changelog pages

**Files:**
- Create: `CHANGELOG.md` (repo root), `site/playwright.config.ts`, `site/tests/e2e/content.spec.ts`, `site/public/favicon.svg`, `site/src/styles/global.css`, `site/src/layouts/Base.astro`, `site/src/components/Header.astro`, `site/src/components/Footer.astro`, `site/src/pages/index.astro`, `site/src/pages/404.astro`, `site/src/pages/[lang]/manifesto.astro`, `site/src/pages/[lang]/changelog.astro`

**Interfaces:**
- Consumes: `t`, `localePath`, `localeStaticPaths`, `defaultLocale`, `type Locale` (Task 2); `GITHUB_URL` (Task 2); `loadManifesto` (Task 3); `renderMarkdown`, `readRepoFile` (Task 3).
- Produces: `Base.astro` with props `{ lang: Locale; title?: string; description?: string }` and a default slot; pages `/`, `/en/manifesto`, `/en/changelog`, 404.

- [ ] **Step 1: Create repo-root `CHANGELOG.md`**

```markdown
# Changelog

Every version of the manifesto, what changed and why.

## 0.1 · 2026-11-13

First draft, published for public feedback.
```

- [ ] **Step 2: Create `site/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

const port = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && HOST=127.0.0.1 PORT=${port} node dist/server/entry.mjs`,
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Run once locally: `npx playwright install chromium`

- [ ] **Step 3: Write the failing E2E tests** — `site/tests/e2e/content.spec.ts`

```ts
import { expect, test } from '@playwright/test';

test('root redirects to the English homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/$/);
});

test('manifesto page shows title, version and full text', async ({ page }) => {
  await page.goto('/en/manifesto');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The Shoulders of Giants Manifesto',
  );
  await expect(page.getByText(/^Version \d+(\.\d+)+$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Call to action' })).toBeVisible();
});

test('every table-of-contents link resolves to exactly one heading', async ({ page }) => {
  await page.goto('/en/manifesto');
  const hrefs = await page
    .locator('nav.toc a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(5);
  for (const href of hrefs) {
    await expect(page.locator(`[id="${href.slice(1)}"]`)).toHaveCount(1);
  }
});

test('changelog lists version 0.1', async ({ page }) => {
  await page.goto('/en/changelog');
  await expect(page.getByRole('heading', { name: /^0\.1/ })).toBeVisible();
});

test('pages work without a trailing slash', async ({ page }) => {
  const response = await page.goto('/en/manifesto/');
  expect(response?.status()).toBe(200);
});

test('unknown locale returns 404', async ({ page }) => {
  const response = await page.goto('/xx/manifesto');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm run test:e2e -- content`
Expected: FAIL (no pages yet; `/` returns 404).

- [ ] **Step 5: Create `site/public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="9" r="5" fill="#8a3b12"/><circle cx="16" cy="24" r="7" fill="#8a3b12"/></svg>
```

- [ ] **Step 6: Create `site/src/styles/global.css`**

```css
:root {
  --bg: #fbfaf7;
  --fg: #1d1b18;
  --muted: #5f5a52;
  --accent: #8a3b12;
  --accent-fg: #ffffff;
  --rule: #e4e0d8;
  --surface: #f2efe8;
  --measure: 42rem;
  --font-body: Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif;
  --font-ui: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151412;
    --fg: #ece8e1;
    --muted: #a8a197;
    --accent: #f0a46c;
    --accent-fg: #151412;
    --rule: #2e2b27;
    --surface: #1f1d1a;
    color-scheme: dark;
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-body);
  font-size: 1.125rem;
  line-height: 1.6;
}

a {
  color: var(--accent);
  text-underline-offset: 0.15em;
}

:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.skip-link {
  position: absolute;
  left: -999rem;
}

.skip-link:focus {
  left: 1rem;
  top: 1rem;
  z-index: 10;
  padding: 0.5rem 1rem;
  background: var(--bg);
}

.site-header,
main,
.site-footer {
  max-width: var(--measure);
  margin-inline: auto;
  padding-inline: 1rem;
}

.site-header {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  align-items: baseline;
  justify-content: space-between;
  padding-block: 1.25rem;
  border-bottom: 1px solid var(--rule);
  font-family: var(--font-ui);
  font-size: 1rem;
}

.brand {
  color: var(--fg);
  font-weight: 700;
  text-decoration: none;
}

.site-header ul,
.site-footer ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

[aria-current='page'] {
  font-weight: 700;
}

main {
  padding-block: 2.5rem 4rem;
}

h1,
h2,
h3 {
  line-height: 1.25;
  text-wrap: balance;
}

h1 {
  margin-block: 0 1rem;
  font-size: clamp(2rem, 6vw, 3rem);
}

h2 {
  margin-top: 2.5rem;
  font-size: 1.6rem;
}

h3 {
  margin-top: 2rem;
  font-size: 1.25rem;
}

blockquote {
  margin: 1.5rem 0;
  padding-left: 1rem;
  border-left: 3px solid var(--accent);
  color: var(--muted);
  font-style: italic;
}

.prose :is(p, li) {
  overflow-wrap: break-word;
}

.meta {
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 0.95rem;
}

.toc {
  margin-block: 1.5rem 2rem;
  padding: 1rem 1.25rem;
  border-radius: 6px;
  background: var(--surface);
  font-family: var(--font-ui);
  font-size: 1rem;
}

.toc ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toc-depth-3 {
  padding-left: 1rem;
}

.button {
  display: inline-block;
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  background: var(--accent);
  color: var(--accent-fg);
  font-family: var(--font-ui);
  font-weight: 600;
  text-decoration: none;
}

.callout {
  margin-top: 3rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
}

section + section {
  margin-top: 3rem;
}

.site-footer {
  padding-block: 2rem;
  border-top: 1px solid var(--rule);
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 0.95rem;
}
```

- [ ] **Step 7: Create layout and components**

`site/src/layouts/Base.astro`:
```astro
---
import Footer from '../components/Footer.astro';
import Header from '../components/Header.astro';
import { type Locale, t } from '../i18n';
import '../styles/global.css';

interface Props {
  lang: Locale;
  title?: string;
  description?: string;
}

const { lang, title, description } = Astro.props;
const siteName = t(lang, 'site.name');
const pageTitle = title ? `${title} · ${siteName}` : siteName;
const metaDescription = description ?? t(lang, 'site.description');
const canonical = new URL(Astro.url.pathname, Astro.site);
---

<!doctype html>
<html lang={lang}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{pageTitle}</title>
    <meta name="description" content={metaDescription} />
    <link rel="canonical" href={canonical} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={pageTitle} />
    <meta property="og:description" content={metaDescription} />
    <meta property="og:url" content={canonical} />
  </head>
  <body>
    <a class="skip-link" href="#main">{t(lang, 'a11y.skip')}</a>
    <Header lang={lang} />
    <main id="main"><slot /></main>
    <Footer lang={lang} />
  </body>
</html>
```

`site/src/components/Header.astro`:
```astro
---
import { type Locale, localePath, t } from '../i18n';

interface Props {
  lang: Locale;
}

const { lang } = Astro.props;
const links = [
  { href: localePath(lang, '/manifesto'), label: t(lang, 'nav.manifesto') },
  { href: localePath(lang, '/changelog'), label: t(lang, 'nav.changelog') },
  { href: localePath(lang, '/contact'), label: t(lang, 'nav.contact') },
];
const current = Astro.url.pathname.replace(/\/$/, '');
---

<header class="site-header">
  <a class="brand" href={localePath(lang)}>{t(lang, 'site.shortName')}</a>
  <nav aria-label={t(lang, 'a11y.mainNav')}>
    <ul>
      {links.map((link) => (
        <li>
          <a href={link.href} aria-current={current === link.href ? 'page' : undefined}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
</header>
```

`site/src/components/Footer.astro`:
```astro
---
import { type Locale, localePath, t } from '../i18n';
import { GITHUB_URL } from '../lib/site';

interface Props {
  lang: Locale;
}

const { lang } = Astro.props;
---

<footer class="site-footer">
  <nav aria-label={t(lang, 'a11y.footerNav')}>
    <ul>
      <li><a href={`${localePath(lang)}#about`}>{t(lang, 'footer.about')}</a></li>
      <li><a href={localePath(lang, '/contact')}>{t(lang, 'footer.contact')}</a></li>
      <li><a href={localePath(lang, '/privacy')}>{t(lang, 'footer.privacy')}</a></li>
      <li><a href={localePath(lang, '/imprint')}>{t(lang, 'footer.imprint')}</a></li>
      <li><a href={GITHUB_URL}>{t(lang, 'footer.source')}</a></li>
    </ul>
  </nav>
</footer>
```

- [ ] **Step 8: Create pages**

`site/src/pages/index.astro`:
```astro
---
import { defaultLocale, localePath } from '../i18n';

return Astro.redirect(localePath(defaultLocale), 302);
---
```

`site/src/pages/404.astro`:
```astro
---
import { defaultLocale, localePath, t } from '../i18n';
import Base from '../layouts/Base.astro';

export const prerender = true;

const lang = defaultLocale;
---

<Base lang={lang} title={t(lang, 'notFound.title')}>
  <h1>{t(lang, 'notFound.title')}</h1>
  <p>{t(lang, 'notFound.text')}</p>
  <p><a href={localePath(lang)}>{t(lang, 'notFound.home')}</a></p>
</Base>
```

`site/src/pages/[lang]/manifesto.astro`:
```astro
---
import { type Locale, localeStaticPaths, t } from '../../i18n';
import Base from '../../layouts/Base.astro';
import { loadManifesto } from '../../lib/manifesto';
import { GITHUB_URL } from '../../lib/site';

export const prerender = true;
export const getStaticPaths = localeStaticPaths;

const lang = Astro.params.lang as Locale;
const manifesto = loadManifesto();
---

<Base lang={lang} title={t(lang, 'manifesto.title')}>
  <article class="prose">
    <h1>{manifesto.title}</h1>
    <p class="meta">{t(lang, 'manifesto.version', { version: manifesto.version })}</p>
    <nav class="toc" aria-label={t(lang, 'a11y.toc')}>
      <ol>
        {manifesto.toc.map((entry) => (
          <li class={`toc-depth-${entry.depth}`}>
            <a href={`#${entry.id}`}>{entry.text}</a>
          </li>
        ))}
      </ol>
    </nav>
    <Fragment set:html={manifesto.html} />
    <aside class="callout">
      <p>{t(lang, 'manifesto.shapeText')}</p>
      <p><a href={`${GITHUB_URL}/issues`}>{t(lang, 'manifesto.shapeLink')}</a></p>
    </aside>
  </article>
</Base>
```

`site/src/pages/[lang]/changelog.astro`:
```astro
---
import { type Locale, localeStaticPaths, t } from '../../i18n';
import Base from '../../layouts/Base.astro';
import { renderMarkdown } from '../../lib/markdown';
import { readRepoFile } from '../../lib/repo-files';

export const prerender = true;
export const getStaticPaths = localeStaticPaths;

const lang = Astro.params.lang as Locale;
const { html } = renderMarkdown(readRepoFile('CHANGELOG.md'));
---

<Base lang={lang} title={t(lang, 'changelog.title')}>
  <article class="prose" set:html={html} />
</Base>
```

- [ ] **Step 9: Run E2E tests**

Run: `npm run test:e2e -- content`
Expected: all PASS (`root redirects to the English homepage` only checks the URL; the homepage itself arrives in Task 5). If `unknown locale returns 404` fails because Astro renders `/xx/manifesto` instead of 404, add at the top of each `[lang]` page's frontmatter: `if (!isLocale(Astro.params.lang)) return new Response(null, { status: 404 });` (import `isLocale` from `../../i18n`) and re-run.

- [ ] **Step 10: Run unit tests, type check and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 11: Commit** (from repo root)

```bash
git add CHANGELOG.md site
git commit -m "Add layout, manifesto and changelog pages"
```

---

### Task 5: Homepage, contact, privacy and imprint pages with accessibility checks

**Files:**
- Create: `site/content/legal/privacy.en.md`, `site/content/legal/imprint.en.md`, `site/src/pages/[lang]/index.astro`, `site/src/pages/[lang]/contact.astro`, `site/src/pages/[lang]/privacy.astro`, `site/src/pages/[lang]/imprint.astro`, `site/tests/e2e/accessibility.spec.ts`
- Modify: `site/tests/e2e/content.spec.ts` (append tests)

**Interfaces:**
- Consumes: `Base.astro` (Task 4); `t`, `localePath`, `localeStaticPaths`, `type Locale` (Task 2); `GITHUB_URL`, `CONTACT_EMAIL`, `INITIATOR_URL`, `COMPUTERKUNST_URL` (Task 2); `loadManifesto` (Task 3); `renderMarkdown`, `readSiteFile` (Task 3).
- Produces: pages `/en/`, `/en/contact`, `/en/privacy`, `/en/imprint`; homepage anchor `#about`.

- [ ] **Step 1: Append failing E2E tests** to `site/tests/e2e/content.spec.ts`

```ts
test('homepage shows the intro, a link to the full text and who is behind it', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'The Shoulders of Giants Manifesto',
  );
  await expect(page.getByText('Common good', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Read the full manifesto' }).click();
  await expect(page).toHaveURL(/\/en\/manifesto$/);
});

test('about section names the initiator in a personal capacity', async ({ page }) => {
  await page.goto('/en/#about');
  const about = page.locator('#about');
  await expect(about).toContainText('in a personal capacity');
  await expect(about.getByRole('link', { name: 'Philipp Eckert' })).toHaveAttribute(
    'href',
    'https://eckert.rocks',
  );
  await expect(about.getByRole('link', { name: 'Computerkunst e.V.' })).toHaveAttribute(
    'href',
    'https://computerkunst.info',
  );
});

test('contact page shows the contact address', async ({ page }) => {
  await page.goto('/en/contact');
  await expect(page.getByRole('link', { name: 'contact@giantsmanifesto.org' })).toHaveAttribute(
    'href',
    'mailto:contact@giantsmanifesto.org',
  );
});

test('legal pages render their headings', async ({ page }) => {
  await page.goto('/en/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  await page.goto('/en/imprint');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Imprint');
});
```

- [ ] **Step 2: Write the failing accessibility tests** — `site/tests/e2e/accessibility.spec.ts`

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const publicPages = [
  '/en/',
  '/en/manifesto',
  '/en/changelog',
  '/en/contact',
  '/en/privacy',
  '/en/imprint',
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    for (const path of publicPages) {
      test(`${path} has no accessibility violations`, async ({ page }) => {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}

for (const path of publicPages) {
  test(`${path} fits a 375px wide screen`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:e2e`
Expected: the new content tests and the accessibility tests for `/en/`, `/en/contact`, `/en/privacy`, `/en/imprint` FAIL (404).

- [ ] **Step 4: Create legal texts**

`site/content/legal/privacy.en.md`:
```markdown
# Privacy policy

This policy describes the website giantsmanifesto.org in its current form. It will be extended before signing opens.

## Who is responsible

Philipp Eckert, contact@giantsmanifesto.org. Postal address: see the [imprint](/en/imprint).

## What this website stores

This website sets no cookies, uses no analytics and loads nothing from third parties.

To deliver pages, the web server processes your IP address and the requested page. The application does not write IP addresses to its logs.

## Hosting

The website runs on a server rented by the initiator. Hosting provider: to be named before launch.

## Your rights

You have the right to access, rectification, erasure, restriction of processing, data portability and objection under Articles 15 to 21 GDPR. Write to contact@giantsmanifesto.org. You may also lodge a complaint with a data protection supervisory authority.
```

`site/content/legal/imprint.en.md`:
```markdown
# Imprint

Information according to § 5 DDG (German Digital Services Act).

## Responsible for this website

Philipp Eckert
Postal address: to be added before launch

## Contact

Email: contact@giantsmanifesto.org

## Responsible for content according to § 18 (2) MStV

Philipp Eckert, address as above
```

- [ ] **Step 5: Create pages**

`site/src/pages/[lang]/index.astro`:
```astro
---
import { type Locale, localePath, localeStaticPaths, t } from '../../i18n';
import Base from '../../layouts/Base.astro';
import { loadManifesto } from '../../lib/manifesto';
import { COMPUTERKUNST_URL, GITHUB_URL, INITIATOR_URL } from '../../lib/site';

export const prerender = true;
export const getStaticPaths = localeStaticPaths;

const lang = Astro.params.lang as Locale;
const manifesto = loadManifesto();
const initiator = t(lang, 'home.aboutInitiator', {
  name: `<a href="${INITIATOR_URL}">Philipp Eckert</a>`,
  org: `<a href="${COMPUTERKUNST_URL}">Computerkunst e.V.</a>`,
});
---

<Base lang={lang}>
  <section class="prose">
    <h1>{manifesto.title}</h1>
    <Fragment set:html={manifesto.introHtml} />
    <p>
      <a class="button" href={localePath(lang, '/manifesto')}>{t(lang, 'home.readManifesto')}</a>
    </p>
    <p class="meta">{t(lang, 'home.version', { version: manifesto.version })}</p>
  </section>

  <section class="prose" aria-labelledby="shape-title">
    <h2 id="shape-title">{t(lang, 'home.shapeTitle')}</h2>
    <p>{t(lang, 'home.shapeText')}</p>
    <p><a href={`${GITHUB_URL}/issues`}>{t(lang, 'home.shapeLink')}</a></p>
  </section>

  <section class="prose" id="about" aria-labelledby="about-title">
    <h2 id="about-title">{t(lang, 'home.aboutTitle')}</h2>
    <p set:html={initiator} />
    <p>{t(lang, 'home.aboutProcess')}</p>
  </section>
</Base>
```

`site/src/pages/[lang]/contact.astro`:
```astro
---
import { type Locale, localePath, localeStaticPaths, t } from '../../i18n';
import Base from '../../layouts/Base.astro';
import { CONTACT_EMAIL, GITHUB_URL } from '../../lib/site';

export const prerender = true;
export const getStaticPaths = localeStaticPaths;

const lang = Astro.params.lang as Locale;
const intro = t(lang, 'contact.intro', {
  email: `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`,
});
const feedback = t(lang, 'contact.feedback', { github: `<a href="${GITHUB_URL}/issues">GitHub</a>` });
---

<Base lang={lang} title={t(lang, 'contact.title')}>
  <article class="prose">
    <h1>{t(lang, 'contact.title')}</h1>
    <p set:html={intro} />
    <p set:html={feedback} />
    <p>
      {t(lang, 'contact.initiator')}
      <a href={`${localePath(lang)}#about`}>{t(lang, 'footer.about')}</a>
    </p>
  </article>
</Base>
```

`site/src/pages/[lang]/privacy.astro`:
```astro
---
import { type Locale, localeStaticPaths, t } from '../../i18n';
import Base from '../../layouts/Base.astro';
import { renderMarkdown } from '../../lib/markdown';
import { readSiteFile } from '../../lib/repo-files';

export const prerender = true;
export const getStaticPaths = localeStaticPaths;

const lang = Astro.params.lang as Locale;
const { html } = renderMarkdown(readSiteFile(`content/legal/privacy.${lang}.md`));
---

<Base lang={lang} title={t(lang, 'legal.privacy')}>
  <article class="prose" set:html={html} />
</Base>
```

`site/src/pages/[lang]/imprint.astro`:
```astro
---
import { type Locale, localeStaticPaths, t } from '../../i18n';
import Base from '../../layouts/Base.astro';
import { renderMarkdown } from '../../lib/markdown';
import { readSiteFile } from '../../lib/repo-files';

export const prerender = true;
export const getStaticPaths = localeStaticPaths;

const lang = Astro.params.lang as Locale;
const { html } = renderMarkdown(readSiteFile(`content/legal/imprint.${lang}.md`));
---

<Base lang={lang} title={t(lang, 'legal.imprint')}>
  <article class="prose" set:html={html} />
</Base>
```

- [ ] **Step 6: Run all E2E tests**

Run: `npm run test:e2e`
Expected: all PASS. If axe reports a `color-contrast` violation, adjust the colour token in `global.css` named in the violation (keep light and dark in sync) and re-run; don't disable rules.

- [ ] **Step 7: Run unit tests, type check and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 8: Commit** (from repo root)

```bash
git add site
git commit -m "Add homepage, contact and legal pages with accessibility checks"
```

---

### Task 6: Docker image and Coolify setup guide

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docs/deploy-coolify.md` (all in repo root)

**Interfaces:**
- Consumes: npm scripts `build`, `start` (Task 1); `/healthz` (Task 1); content files in repo root.
- Produces: image serving the site on port 3000 with a Docker `HEALTHCHECK`; build-time variable `SITE_URL`.

- [ ] **Step 1: Create `.dockerignore`**

```
.git
.github
docs
**/node_modules
site/dist
site/.astro
site/test-results
site/playwright-report
.env
.env.*
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
FROM node:22-bookworm-slim AS build
WORKDIR /repo/site
COPY site/package.json site/package-lock.json ./
RUN npm ci
COPY Shoulders-of-Giants-Manifesto.md CHANGELOG.md /repo/
COPY site/ ./
ARG SITE_URL=https://giantsmanifesto.org
ENV SITE_URL=$SITE_URL
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /repo/site
COPY Shoulders-of-Giants-Manifesto.md CHANGELOG.md /repo/
COPY --from=build /repo/site/package.json ./
COPY --from=build /repo/site/node_modules ./node_modules
COPY --from=build /repo/site/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server/entry.mjs"]
```

The content files are copied into the runtime image too, because later milestones render the homepage on the server.

- [ ] **Step 3: Build and smoke-test the image** (from repo root; requires Docker locally, otherwise skip and note it in the task report)

Run:
```bash
docker build -t giantsmanifesto .
docker run --rm -d -p 3000:3000 --name giantsmanifesto giantsmanifesto
sleep 3
curl -fsS http://localhost:3000/healthz
curl -fsS http://localhost:3000/en/ | grep -c "Shoulders of Giants"
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:3000/
docker stop giantsmanifesto
```
Expected: `ok`; a count ≥ 1; `302`.

- [ ] **Step 4: Create `docs/deploy-coolify.md`**

````markdown
# Deploying to Coolify

One-time setup. Coolify menu labels can differ slightly between versions.

## 1. DNS

At the registrar, point both names to the VPS:

| Type | Name | Value |
|---|---|---|
| A | `@` | VPS IPv4 |
| A | `www` | VPS IPv4 |
| AAAA | `@`, `www` | VPS IPv6 (if available) |

## 2. Application

1. **New Resource → Public Repository**: `https://github.com/v3nomsoup/giantsmanifesto`, branch `main`.
2. **Build Pack**: Dockerfile, location `/Dockerfile`.
3. **Ports Exposes**: `3000`.
4. **Domains**: `https://giantsmanifesto.org,https://www.giantsmanifesto.org`, with redirect to non-www.
5. **Environment Variables**: `SITE_URL=https://giantsmanifesto.org`, marked as **build variable**.
6. **Health Check**: enabled, path `/healthz`, port `3000`.
7. **Auto Deploy**: off (CI triggers deployments after tests pass).
8. Deploy once manually and open `https://giantsmanifesto.org/healthz`.

## 3. Deploy trigger from GitHub Actions

1. In the application's **Webhooks** section, copy the **Deploy Webhook** URL.
2. Under **Keys & Tokens → API tokens**, create a token with deploy permission.
3. Store both as repository secrets:

```bash
gh secret set COOLIFY_WEBHOOK --repo v3nomsoup/giantsmanifesto
gh secret set COOLIFY_TOKEN --repo v3nomsoup/giantsmanifesto
```

Until `COOLIFY_WEBHOOK` is set, the CI deploy step skips itself.

## Updating the manifesto

Edit `Shoulders-of-Giants-Manifesto.md`, bump the `*Version X.Y · …*` line, add an entry to `CHANGELOG.md`, push to `main`. CI tests and then deploys.
````

- [ ] **Step 5: Commit** (from repo root)

```bash
git add Dockerfile .dockerignore docs/deploy-coolify.md
git commit -m "Add Docker image and Coolify setup guide"
```

---

### Task 7: CI workflow with gated deployment

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: npm scripts `lint`, `typecheck`, `test`, `test:e2e` (Task 1); secrets `COOLIFY_WEBHOOK`, `COOLIFY_TOKEN` (Task 6 guide).
- Produces: jobs `check` (every push and PR), `e2e` (PRs), `deploy` (push to `main`, after `check`).

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: site
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: site/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

  e2e:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: site
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: site/package-lock.json
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: site/playwright-report

  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: check
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Coolify deployment
        env:
          COOLIFY_WEBHOOK: ${{ secrets.COOLIFY_WEBHOOK }}
          COOLIFY_TOKEN: ${{ secrets.COOLIFY_TOKEN }}
        run: |
          if [ -z "$COOLIFY_WEBHOOK" ]; then
            echo "COOLIFY_WEBHOOK is not set; skipping deployment."
            exit 0
          fi
          curl --fail --silent --show-error \
            -H "Authorization: Bearer $COOLIFY_TOKEN" \
            "$COOLIFY_WEBHOOK"
```

- [ ] **Step 2: Validate the workflow locally** (optional, if `actionlint` is installed)

Run (repo root): `actionlint .github/workflows/ci.yml`
Expected: no output.

- [ ] **Step 3: Commit** (from repo root)

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI with tests and gated Coolify deployment"
```

- [ ] **Step 4: Push and verify CI** (only after the initiator has approved pushing this milestone)

Run (repo root): `git push && gh run watch --repo v3nomsoup/giantsmanifesto --exit-status`
Expected: `check` passes; `deploy` passes and logs "COOLIFY_WEBHOOK is not set; skipping deployment." until the Coolify secrets exist.

---

## Done when

- `npm test`, `npm run lint`, `npm run typecheck` and `npm run test:e2e` pass in `site/`.
- The Docker image serves `/healthz`, `/en/` and redirects `/`.
- CI is green on `main`.
- Open items for the initiator (not code): postal address in `site/content/legal/imprint.en.md`, hosting provider in `site/content/legal/privacy.en.md`, legal review of both, Coolify setup per `docs/deploy-coolify.md`.
