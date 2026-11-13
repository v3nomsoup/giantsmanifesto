# Visual Design ("Lineage") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the M1 site the "Lineage" look (cool grey/graphite/blue, Hanken Grotesk + Literata, the convergence drawing as illustration, logo and favicon) plus a light/dark switch.

**Architecture:** Design tokens live on `:root` in `site/src/styles/global.css`, with dark tokens selected by `prefers-color-scheme` or an explicit `data-theme` on `<html>`. An inline head script applies a stored choice before first paint; a `ThemeToggle` component flips it. Fonts come from `@fontsource` packages, bundled by Vite into our own assets. The drawing is one Astro component with a full and a mark variant. The homepage hero gets structured pieces (quote, statement, values) from the manifesto parser.

**Tech Stack:** Astro 7 (node adapter), TypeScript, Vitest, Playwright + @axe-core/playwright, Biome, @fontsource/hanken-grotesk 5.x, @fontsource/literata 5.x.

**Spec:** `docs/specs/2026-11-13-visual-design.md`

## Global Constraints

- All commands run from `site/`. Checks before every commit: `npm run lint`, `npm run typecheck`, `npm test`; e2e (`npm run test:e2e`) for tasks that touch pages.
- Commits: plain messages, **no `Co-Authored-By` trailer and no Claude/AI attribution**. Repo-local git identity is already set; never change git config.
- No external requests at runtime: no Google Fonts, CDNs or analytics. Fonts via `@fontsource/*` imports only (latin subsets: `latin-400.css`, `latin-500.css`, `latin-700.css` for Hanken Grotesk; `latin-400.css`, `latin-400-italic.css` for Literata).
- Colour tokens (light / dark):
  - `--bg` `#EEF1F3` / `#151A20`
  - `--surface` `#E3E8EC` / `#1D242C`
  - `--fg` `#1E242B` / `#E4E9EE`
  - `--muted` `#56606B` / `#A9B2BC`
  - `--faint` `#626B75` / `#8E98A3` (used for text, must pass WCAG AA 4.5:1 on `--bg`; adjust only if axe fails)
  - `--line` `#9AA7B4` / `#46525F`
  - `--accent` `#2E6FA8` / `#7DB3E3`
  - `--btn` / `--btn-fg` `#1E242B` / `#FFFFFF` (light), `#E4E9EE` / `#151A20` (dark)
- Dark tokens apply under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and under `:root[data-theme="dark"]`. `color-scheme` follows the active theme.
- Fonts: `--font-ui: 'Hanken Grotesk', system-ui, sans-serif`; `--font-text: 'Literata', Georgia, serif`. UI, nav, headings, homepage in `--font-ui`; manifesto/changelog/legal body text and the Newton quote in `--font-text`. Body text 1.125rem, line-height 1.7 for Literata, measure ≤ 70ch.
- Headline: weight 700, letter-spacing −0.02em, `clamp(1.9rem, 5vw, 2.6rem)`, max-width about 13em.
- localStorage key `theme`, values `light` | `dark`. Without JS the toggle is hidden (`hidden` attribute removed by script) and the system setting applies.
- Left aligned throughout. Visible focus ring in `--accent` in both themes.
- Nav stays Manifesto, Changelog, Contact (no Signatures/Shape it yet).
- i18n: every new visible or accessible string goes through `src/i18n/en.json` and `t()`.

## Review Focus

1. A stored `theme` of an unexpected value (e.g. `"blue"`) or localStorage throwing (privacy mode): the page must fall back to the system theme without errors. Test in Task 1.
2. Dark system setting + stored `light`: light must win (and vice versa). Test in Task 1.
3. The drawing overlapping text or causing horizontal scroll at 375px wide. Covered by the existing 375px overflow test plus a bounding-box check in Task 3.
4. Manifesto edits that change the intro (missing quote, extra value line): the build must fail with a clear message, not render a broken hero. Test in Task 3.
5. TOC highlight with JS disabled, or a heading anchor deep link (`/en/manifesto#preamble`): page still works, correct section marked once scrolled. Test in Task 4.

---

### Task 1: Tokens, fonts and theme switch

**Files:**
- Modify: `site/package.json` (add `@fontsource/hanken-grotesk`, `@fontsource/literata` as dependencies)
- Modify: `site/src/styles/global.css` (new tokens per Global Constraints, fonts, button uses `--btn`/`--btn-fg`, links/focus use `--accent`, `.theme-toggle` styles: 2rem round button, 1px `--line` border)
- Create: `site/src/styles/fonts.ts` *or* import the `@fontsource` CSS files at the top of `Base.astro`'s frontmatter (builder's choice; keep it in one place)
- Create: `site/src/components/ThemeToggle.astro`
- Modify: `site/src/layouts/Base.astro` (inline head script, before stylesheet links take effect)
- Modify: `site/src/components/Header.astro` (toggle as last item after the nav)
- Modify: `site/src/i18n/en.json` (`theme.toDark`: "Switch to dark theme", `theme.toLight`: "Switch to light theme")
- Modify: `site/content/legal/privacy.en.md` (append one sentence in the section that describes what the site stores, or a short new section if none fits: "If you switch between light and dark theme, your choice is stored in your browser's local storage. It is never sent to our server." Do not change any other line of this file.)
- Test: `site/tests/e2e/theme.spec.ts`, modify `site/tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Produces: CSS custom properties `--bg --surface --fg --muted --faint --line --accent --btn --btn-fg --font-ui --font-text --measure`; `<html data-theme="light|dark">` when a valid choice is stored; `ThemeToggle.astro` with prop `lang: Locale`, rendering `<button class="theme-toggle" type="button" hidden data-label-dark=… data-label-light=…>` containing inline sun and moon SVGs (`aria-hidden="true"`).
- Head script (inline, `is:inline`): reads `localStorage.getItem('theme')` inside try/catch; if `light` or `dark`, sets `document.documentElement.dataset.theme`. Toggle script: determines the current effective theme (`dataset.theme` or `matchMedia('(prefers-color-scheme: dark)')`), flips it, writes `dataset.theme` and localStorage (try/catch), updates `aria-label`, and unhides the button on load.

- [ ] **Step 1: Write failing e2e tests** in `tests/e2e/theme.spec.ts`:
  - `toggle switches light to dark and back`: with `colorScheme: 'light'`, goto `/en/`; button named "Switch to dark theme" is visible; click → `html` has `data-theme="dark"` and button name "Switch to light theme"; `getComputedStyle(body).backgroundColor` is `rgb(21, 26, 32)`.
  - `choice survives a reload`: click to dark, reload, `data-theme="dark"`, background still `rgb(21, 26, 32)`.
  - `stored light beats a dark system setting`: `colorScheme: 'dark'`, `page.addInitScript(() => localStorage.setItem('theme','light'))`, goto `/en/` → background `rgb(238, 241, 243)`.
  - `invalid stored value falls back to the system theme`: store `'blue'`, `colorScheme: 'dark'` → no `data-theme` attribute, background `rgb(21, 26, 32)`, no page errors (`page.on('pageerror')` collects none).
  - `without JavaScript the toggle is hidden`: `test.use({ javaScriptEnabled: false })` → `.theme-toggle` not visible.
  - `no request leaves our origin`: for each public page, collect `page.on('request')` URLs; every URL starts with the baseURL origin (or `data:`).
- [ ] **Step 2: Extend `accessibility.spec.ts`** so each page is also checked with an explicit theme: add a loop over `['light','dark']` that sets `localStorage.theme` via `addInitScript` (in addition to the existing `colorScheme` loop).
- [ ] **Step 3: Run** `npm run test:e2e -- theme accessibility` → theme tests FAIL (no toggle).
- [ ] **Step 4: Implement** tokens, fonts, head script, `ThemeToggle`, header placement, i18n strings, privacy sentence.
- [ ] **Step 5: Run** `npm run lint && npm run typecheck && npm test && npm run test:e2e` → all PASS (existing content tests still pass; axe clean in all theme combinations; if `--faint`/`--accent` fail contrast, darken/lighten minimally and note it in the report).
- [ ] **Step 6: Commit** `git add -A site && git commit -m "Add Lineage design tokens, self-hosted fonts and theme switch"`

### Task 2: Convergence drawing, logo mark and favicon

**Files:**
- Create: `site/src/components/Convergence.astro`
- Modify: `site/src/components/Header.astro` (mark before the brand text inside the brand link)
- Modify: `site/public/favicon.svg`
- Modify: `site/src/styles/global.css` (`.brand` flex with 0.5rem gap; `.convergence` stroke/fill via tokens)
- Test: `site/tests/e2e/identity.spec.ts`

**Interfaces:**
- Produces: `Convergence.astro` with props `variant: 'full' | 'mark'` and optional `class?: string`. Renders an inline `<svg class="convergence convergence--{variant}" aria-hidden="true" focusable="false">`. `full`: `viewBox="0 0 380 340"`, 8 base points on y=320 (x = 40, 90, 140, 190, 240, 290, 340, 375), each joined by a cubic curve to the apex (300, 60); strokes `var(--line)` 1px, base dots r=3 in `var(--line)`, apex r=5 in `var(--accent)`. `mark`: `viewBox="0 0 18 18"`, 4 curves from apex (9, 3) to (2|7|11|16, 16), stroke `currentColor` 1.3, apex r=2 in `var(--accent)`. Every curve is its own `<path>` (Follow-up animation relies on this).
- Favicon: same geometry as `mark`, with an inline `<style>` using `@media (prefers-color-scheme: dark)` to switch stroke from `#1E242B` to `#E4E9EE`; apex `#2E6FA8` / `#7DB3E3`.

- [ ] **Step 1: Write failing tests** in `identity.spec.ts`:
  - `header shows the logo mark inside the home link`: `header a.brand svg.convergence--mark` exists with `aria-hidden="true"`; the link's accessible name is exactly "Shoulders of Giants".
  - `favicon is the theme-aware mark`: `request.get('/favicon.svg')` → 200, `content-type` contains `image/svg+xml`, body contains `prefers-color-scheme`. (The full variant is tested on the homepage in Task 3.)
- [ ] **Step 2: Run** `npm run test:e2e -- identity` → FAIL.
- [ ] **Step 3: Implement** the component, header mark, favicon.
- [ ] **Step 4: Run** full checks (lint, typecheck, unit, e2e) → PASS.
- [ ] **Step 5: Commit** `git commit -m "Add convergence drawing component, logo mark and favicon"`

### Task 3: Homepage hero

**Files:**
- Modify: `site/src/lib/manifesto.ts` (add `intro` to `Manifesto`)
- Modify: `site/src/pages/[lang]/index.astro`
- Modify: `site/src/i18n/en.json` (`home.readManifesto` → "Read the full text")
- Modify: `site/src/styles/global.css` (hero styles)
- Test: `site/tests/unit/manifesto.test.ts`, `site/tests/e2e/content.spec.ts`, `site/tests/e2e/identity.spec.ts`

**Interfaces:**
- Consumes: `Convergence` (`variant="full"`) from Task 2; tokens from Task 1.
- Produces in `manifesto.ts`:
  ```ts
  export interface ManifestoValue { term: string; rest: string } // "Common good", "over private profit"
  export interface ManifestoIntro { quoteHtml: string; statement: string; values: ManifestoValue[] }
  // Manifesto gains: intro: ManifestoIntro  (introHtml stays for compatibility)
  export function parseIntro(intro: string): ManifestoIntro
  ```
  `quoteHtml`: inner HTML of the first blockquote, rendered with `renderMarkdown` (keeps the attribution line). `statement`: text of the first paragraph that is entirely `**…**`, without the asterisks. `values`: every list item of the form `- **Term** rest`. Throws `Shoulders-of-Giants-Manifesto.md: intro needs a quote, a bold core statement and at least one "- **Value** over …" line` if any part is missing.

- [ ] **Step 1: Write failing unit tests** (`describe('parseIntro')`):
  - fixture from the existing test plus a statement line `**Built from all of us.**` → `statement === 'Built from all of us.'`, `values` equals `[{ term: 'Common good', rest: 'over private profit' }]`, `quoteHtml` contains `A quote`.
  - throws the exact message above when the bold statement is missing; and when there is no value line.
  - real file: `loadManifesto().intro.values.map(v => v.term)` equals `['Common good','Transparency','Shared stewardship','A liveable planet']`; `statement` starts with `The machines that will shape our century`.
  - Update the existing `fixture` so `parseManifesto(fixture)` still parses (add the statement line).
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** `parseIntro` and wire it into `parseManifesto`.
- [ ] **Step 4: Update e2e** in `content.spec.ts`: homepage `h1` now has the core statement text (`/^The machines that will shape our century/`); link name "Read the full text"; values visible as `Common good` with `over private profit` next to it. In `identity.spec.ts` add: `homepage drawing does not overlap the headline` at 1280×800 and 375×800 (bounding boxes of `.convergence--full` and `h1` do not intersect, or the drawing is not visible); `full drawing has eight curves and one apex` (`.convergence--full path` count 8).
- [ ] **Step 5: Implement the page.** Order (spec): headline `h1` = statement; quote (`--font-text`, italic, `--muted`); values `<ul class="values">` with `<strong>term</strong> <span>rest</span>` (rest in `--faint`); primary button "Read the full text" (`.button` → `--btn`); version line (`.meta`); "Shape it" section; rule; "Who's behind this" (`#about`). Drawing to the right of the headline on wide screens (absolutely positioned within a `position: relative` hero, `aria-hidden`), hidden below 48rem. Keep `<title>` as the site name.
- [ ] **Step 6: Run** full checks → PASS.
- [ ] **Step 7: Commit** `git commit -m "Redesign homepage hero around the core statement and convergence drawing"`

### Task 4: Manifesto page reading layout

**Files:**
- Modify: `site/src/lib/markdown.ts` (wrap a leading roman numeral in headings)
- Modify: `site/src/pages/[lang]/manifesto.astro`
- Modify: `site/src/styles/global.css` (two-column layout ≥ 64rem, sticky TOC, body in `--font-text`)
- Test: `site/tests/unit/markdown.test.ts`, `site/tests/e2e/content.spec.ts`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: headings whose text starts with `/^([IVXLC]+\.)\s+/` render the numeral as `<span class="numeral">I.</span> ` inside the heading (inside the heading link when `headingLinks`); slug ids and TOC text unchanged. TOC links get `aria-current="location"` for the section in view.

- [ ] **Step 1: Write failing unit tests**: `renderMarkdown('### I. First principle', { headingLinks: true }).html` contains `<span class="numeral">I.</span> First principle` and `id="i-first-principle"`; `'## Preamble'` contains no `numeral`; toc text stays `I. First principle`.
- [ ] **Step 2: Run** `npm test` → FAIL; **implement**; run → PASS.
- [ ] **Step 3: Write failing e2e tests** in `content.spec.ts`:
  - `TOC marks the section in view on wide screens`: viewport 1280×900, goto `/en/manifesto#preamble`, then `page.locator('#call-to-action').scrollIntoViewIfNeeded()`; expect `nav.toc a[href="#call-to-action"]` to have `aria-current="location"` and exactly one TOC link with `aria-current`.
  - `TOC stays in view while reading`: at 1280×900 scroll to the bottom; `nav.toc` bounding box top ≥ 0 and is visible.
  - `TOC sits above the text on phones`: 375×800; `nav.toc` box bottom ≤ first `h2` box top.
  - With `javaScriptEnabled: false`: TOC links still navigate (click "Preamble" → URL ends `#preamble`).
- [ ] **Step 4: Implement**: grid layout `12rem 1fr` from 64rem, TOC `position: sticky; top: 1.5rem; max-height: calc(100vh - 3rem); overflow: auto`, 1px `--line` left rule, current link bold with an 7px `--accent` dot; main width widens on this page only (`body` class or a page-level wrapper — not by changing `--measure` globally). Inline script with `IntersectionObserver` on body headings that appear in the TOC, setting/removing `aria-current="location"`. Numerals in `--muted`.
- [ ] **Step 5: Run** full checks → PASS (axe and 375px overflow included).
- [ ] **Step 6: Commit** `git commit -m "Give the manifesto page a two-column reading layout with live contents"`
