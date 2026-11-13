# giantsmanifesto.org — Visual Design ("Lineage")

**Status:** approved direction, static version. Extends `2026-11-13-giantsmanifesto-website-design.md`, which says nothing about the look.

## Intent

The site should come across as serious and credible to developers and tech-savvy professionals, with a few subtle stylish touches. The current M1 look (warm off-white, serif, rust accent) is readable but generic: it is one of the most common default looks for generated pages. This pass gives the site its own identity before milestone 2 adds the Sign button and signature count to the homepage.

## Approaches considered

Three directions were mocked up with the real homepage content:

- **A · Scholarly:** set like a research paper, serif throughout, Newton's quote as a margin note. Credible, but quieter and more academic than the audience needs.
- **B · Lineage:** a modern sans on cool grey, with one line drawing of many points converging into one (many contributions lifting one model). Feels like a well-run open source project.
- **C · Declaration:** a big condensed headline, white and deep green, values in an Agile-Manifesto-style table. The most assertive.

**Chosen: B · Lineage**, plus a dark mode switch.

## Goals

- A recognizable identity built around one element: the convergence drawing.
- Light and dark themes of equal quality, switchable by the visitor.
- Comfortable long-form reading on the manifesto page.
- Layout that already leaves room for M2's Sign button and signature count.

## Non-goals (this pass)

- Animation of the convergence drawing. That is the next step (see Follow-up).
- Drawing generated from signature data.
- New pages or nav items. The mockups showed "Signatures" and "Shape it"; those arrive with M2 and M4. M1 keeps Manifesto, Changelog, Contact.
- Changes to content or page structure.

## Anti-goals

- External requests of any kind (fonts, scripts, analytics). Everything is self-hosted.
- A flash of the wrong theme on load.
- Decoration that costs readability or accessibility.

## Design

### Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#EEF1F3` | `#151A20` | page background |
| `--surface` | `#E3E8EC` | `#1D242C` | TOC, code, subtle panels |
| `--fg` | `#1E242B` | `#E4E9EE` | text |
| `--muted` | `#56606B` | `#9AA4AF` | secondary text, nav |
| `--faint` | `#8A939D` | `#6E7884` | the "over …" half of each value; check contrast (see below) |
| `--line` | `#9AA7B4` | `#46525F` | drawing strokes, rules |
| `--accent` | `#2E6FA8` | `#7DB3E3` | links, focus ring, the drawing's apex point |
| `--btn` / `--btn-fg` | `#1E242B` / `#FFFFFF` | `#E4E9EE` / `#151A20` | primary button |

All text colours must pass WCAG AA against `--bg` in both themes. `--faint` is used for real text ("over private profit"), so if it fails AA it is darkened (light) or lightened (dark) until it passes, keeping the visual step below `--muted`.

### Typography

- **Hanken Grotesk** (400, 500, 700): UI, nav, headings, homepage.
- **Literata** (400, 400 italic): the Newton quote and the body text of the manifesto, changelog and legal pages.
- Both OFL-licensed, self-hosted as WOFF2 from `site/public/fonts/` (latin subset), with `font-display: swap` and a preload for the two most used files. Fallbacks: `system-ui` and `Georgia`.
- Headline: about 2.6rem desktop, about 1.9rem mobile, weight 700, letter-spacing −0.02em, max width about 13em. Body text: 1.125rem, line-height 1.7 for Literata, measure ≤ 70 characters.

### The convergence drawing

- One SVG drawn from a small set of curves: eight base points along the bottom, each joined by a curve to one apex point in `--accent`. Strokes in `--line`, 1px, no fill.
- Used in three places:
  1. **Homepage illustration:** to the right of the headline on wide screens, behind the text column edge, `aria-hidden`. On narrow screens it shrinks and moves above the headline or is hidden. The builder chooses, so long as it never overlaps text.
  2. **Logo mark:** a simplified 4-curve version, about 18px, next to "Shoulders of Giants" in the header.
  3. **Favicon:** the same mark, replacing `public/favicon.svg`. Use a `prefers-color-scheme` rule inside the SVG so it stays visible on dark tabs.
- Built as an Astro component so the next step can animate it without rework (stable path elements, theme colours via CSS variables).

### Homepage

Order: header → headline (core statement) → Newton quote (Literata italic, muted) → the four values as "**X** over Y", the "over Y" in `--faint` → "Read the full text" (primary button now; in M2 the Sign button takes the primary slot and this becomes a text link) → version line → "Shape it" → "Who's behind this" (`#about`) separated by a rule. Left aligned throughout.

### Manifesto page

- Headings in Hanken Grotesk, roman numerals of the principles in `--muted` before the title. Body in Literata.
- Wide screens (≥ about 64rem): two columns, the table of contents in a sticky left column (about 12rem) with a 1px `--line` rule. The current section is bold, marked with a small `--accent` dot, and set as `aria-current` (`IntersectionObserver`, a few lines of inline JS; without JS the TOC still works, just without the highlight).
- Narrow screens: the TOC sits above the text as today.
- Heading anchor links stay as built.

### Other pages

Changelog, contact, privacy, imprint and 404 take the new tokens and fonts, no layout change.

### Dark mode switch

- A round icon button at the end of the nav: moon in light mode, sun in dark mode. Accessible name "Switch to dark theme" / "Switch to light theme" (i18n strings), `aria-pressed` not used, since the label states the action.
- Default: follow `prefers-color-scheme`. After a click, the choice is stored in `localStorage` (`theme` = `light` | `dark`) and wins over the system setting.
- A small inline script in `<head>` sets `data-theme` on `<html>` before first paint. CSS: tokens on `:root`, dark tokens under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` and under `:root[data-theme="dark"]`. `color-scheme` follows the theme.
- Without JS: the button is hidden and the system setting applies.
- Privacy policy gets one sentence: the theme choice is stored in the browser's local storage, never sent to the server.
- If the CSP later forbids inline scripts, the script gets a hash. Note that in the CSP when it is added.

### Accessibility and quality

- Visible focus ring in `--accent` in both themes, `prefers-reduced-motion` respected (relevant once animation arrives).
- The axe e2e tests run for every public page in **both** themes (set via `data-theme`).
- E2E test for the switch: click toggles `data-theme` and the label, and the choice survives a reload.
- Unit or e2e check that no page requests a resource from another origin.

## Left to the builder

- Exact curve geometry of the drawing and the simplified mark.
- Placement of the drawing on narrow screens (above or hidden).
- Exact spacing scale and breakpoints, within the values above.
- Icon drawing for sun and moon (inline SVG, no icon library).

## Follow-up (next step, separate design)

Animate the convergence drawing, to be explored with a few options:

- Homepage: the curves draw in or converge as you scroll.
- Manifesto page: the drawing sits at the side and connects the points of the table of contents, so reading progress shows as lines joining toward the apex.

Must respect `prefers-reduced-motion` and stay light (no animation library unless the options show it is needed).
