# Milestone 2: Database, Email & Email Signing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** People can sign the manifesto with a confirmed email address, see the public list of signatures and the live count on the homepage, and withdraw their signature by email link.

**Architecture:** SQLite via better-sqlite3 + Drizzle, opened once per process from `DATA_DIR` with Drizzle migrations applied on open. Pending email signatures live as hashed single-use tokens; outgoing mail goes into `mail_queue` and an in-process worker sends it over SMTP (nodemailer) with an hourly cap and backoff. Form pages are server-rendered `.astro` pages that handle their own POST and redirect (Post/Redirect/Get). Abuse protection: honeypot, in-memory per-IP rate limits and a self-hosted ALTCHA challenge. If SMTP or `SESSION_SECRET` is not configured, signing is paused and the site says "Signing opens soon".

**Tech Stack:** Astro 7 (node adapter, standalone), TypeScript, better-sqlite3 13.x, drizzle-orm 0.45.x + drizzle-kit 0.31.x, nodemailer 10.x, altcha-lib 2.x (server) + altcha 3.x (widget), Vitest, Playwright + @axe-core/playwright, Biome, Mailpit (dev/CI only).

**Spec:** `docs/specs/2026-11-13-giantsmanifesto-website-design.md` (sections 5 `signatures`/`email_tokens`/`mail_queue`, 6.2, 6.3 email path, 6.7, 6.8, 7, pages `/sign`, `/signatures`, `/withdraw`, homepage). Roadmap: `docs/plans/2026-11-13-roadmap.md`, milestone 2. Visual rules: `docs/specs/2026-11-13-visual-design.md`.

## Global Constraints

- All commands run from `site/`. Before every commit: `npm run lint`, `npm run typecheck`, `npm test`; plus `npm run test:e2e` for tasks that touch pages.
- Commits: plain messages, **no `Co-Authored-By` trailer and no Claude/AI attribution**. Never change git config.
- Work on a branch, merged to `main` by PR (the `main` ruleset requires a PR and the `check` and `e2e` checks). Every merge to `main` deploys to production via Coolify.
- No runtime requests to other origins (fonts, scripts, ALTCHA). The existing "no request leaves our origin" e2e test must stay green and cover the new pages.
- Every visible or accessible string goes through `src/i18n/en.json` and `t()`, including email text.
- Logs go to stdout and never contain IP addresses, email addresses or tokens.
- Never store an email address in `signatures` or `email_tokens`; only `hashEmail()` of it. The address lives only in `mail_queue.to` until the mail is sent; sent rows are deleted.
- Email normalization: `trim()` then lowercase the whole address. Hash: hex SHA-256 of the normalized address.
- Tokens: 32 random bytes, base64url in links; only hex SHA-256 of the raw token is stored. Email links are valid for **48 hours** and single use.
- A GET never changes state. Confirming a signature and deleting one happen only on POST.
- Signature fields: `display_name` 1–80 characters after trim, `affiliation` 0–120, `country` empty or an ISO 3166-1 alpha-2 code from `COUNTRY_CODES`. Consent checkbox required, label exactly: "I agree that my name, affiliation and country will be published on this site." (the email path has no profile link; M3 adds "profile link" back for providers).
- Mail: `MAIL_MAX_PER_HOUR` default `60`; backoff after failed attempt *n* is `2^n` minutes; give up (delete row, log) after **8** attempts.
- Signing is enabled only when `SMTP_HOST`, `MAIL_FROM` and `SESSION_SECRET` are all set. Otherwise `/sign` and `/withdraw` render a paused notice and accept no POST.
- Env vars added in this milestone (all documented in `.env.example` without values): `DATA_DIR` (default `./data` in dev, `/data` in the Docker image), `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_SECURE` (`true` for port 465), `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_MAX_PER_HOUR`, `TRUST_PROXY` (`1` in the Docker image), `ALTCHA_MAX_NUMBER` (default `100000`).
- Visual: use existing tokens and classes in `global.css`; forms get a small, consistent set of new classes (`.form`, `.field`, `.field-error`, `.notice`). Left aligned. Visible focus. Inputs and errors must pass axe in both themes.
- Nav becomes Manifesto, Signatures, Changelog, Contact. Homepage: "Sign the manifesto" is the primary button; "Read the full text" becomes a text link (visual spec, Homepage).

## Review Focus

1. **Behind Traefik:** Astro's origin check compares the `Origin` header with the request URL, which the node server sees as `http://…` while the browser posts from `https://giantsmanifesto.org`. Every form POST would get 403 in production while all local tests pass. Task 4 configures `security.allowedDomains` from `SITE_URL` and adds a test that a POST with `Origin: https://giantsmanifesto.org`, `X-Forwarded-Proto: https` and `X-Forwarded-Host: giantsmanifesto.org` is accepted, and one with a foreign origin is rejected.
2. **Rate limits keyed on the proxy:** with `TRUST_PROXY` on, every request arrives from Traefik's IP; keying on the socket address would rate-limit the whole world as one client. Keying on the leftmost `X-Forwarded-For` value would let anyone pick their own key. `clientIp()` uses the **rightmost** `X-Forwarded-For` entry when `TRUST_PROXY=1`, else the socket address. Unit-tested in Task 4.
3. **Mail scanners and double clicks:** a link scanner that GETs the confirm link must not sign; a person who clicks "Confirm" twice (or reloads the POST) must see "already confirmed", not an error page or a duplicate. Tests in Task 5.
4. **Same email signs twice:** the second confirmation must say "You have already signed" and link to the existing entry, without a 500 from the unique index (`(provider, provider_subject)`). Test in Task 5.
5. **Withdraw enumeration:** `/withdraw` must answer identically whether or not an address has signed, and send mail only when a signature exists. Test in Task 6.

---

### Task 1: Database foundation and local dev environment

**Files:**
- Modify: `site/package.json` (deps `better-sqlite3`, `drizzle-orm`; dev deps `drizzle-kit`, `@types/better-sqlite3`; script `"db:generate": "drizzle-kit generate"`)
- Create: `site/drizzle.config.ts` (dialect `sqlite`, schema `src/lib/db/schema.ts`, out `drizzle`)
- Create: `site/src/lib/config.ts`
- Create: `site/src/lib/db/schema.ts`, `site/src/lib/db/index.ts`
- Create: `site/drizzle/` (generated migration, committed)
- Modify: `site/src/pages/healthz.ts` (also runs `select 1` against the database)
- Modify: `Dockerfile` (copy `site/drizzle` into the runtime image; `ENV DATA_DIR=/data TRUST_PROXY=1`; `RUN mkdir -p /data && chown node:node /data` before `USER node`; `VOLUME /data`)
- Create: `docker-compose.yml` (repo root: `app` built from `Dockerfile`, port 3000, named volume on `/data`, SMTP env pointing at `mailpit:1025`, `SESSION_SECRET=dev-only-secret`, `MAIL_FROM=contact@giantsmanifesto.org`; `mailpit` from `axllent/mailpit`, ports 1025 and 8025)
- Create: `.env.example` (repo root; every variable from spec section 8 plus the new ones in Global Constraints, each with a one-line comment, no values)
- Modify: `.gitignore` (`site/data/`), `.dockerignore` (`site/data`)
- Modify: `site/vitest.config.ts` (each test file gets its own temporary `DATA_DIR`; see Step 3)
- Test: `site/tests/unit/db.test.ts`, `site/tests/unit/config.test.ts`, `site/tests/unit/healthz.test.ts`

**Interfaces:**
- Produces `config.ts`: `interface Config { siteUrl: string; dataDir: string; sessionSecret?: string; smtp?: { host: string; port: number; secure: boolean; user?: string; password?: string }; mailFrom?: string; mailMaxPerHour: number; trustProxy: boolean; altchaMaxNumber: number }`, `readConfig(env: NodeJS.ProcessEnv = process.env): Config`, `signingEnabled(config: Config): boolean`.
- Produces `db/schema.ts`: Drizzle tables `signatures`, `emailTokens`, `mailQueue` with the columns from spec section 5 (snake_case column names; timestamps as integer milliseconds; `signatures.hidden` boolean default false; unique index `signatures_provider_subject` on `(provider, provider_subject)`; index on `signatures.created_at`; `email_tokens.token_hash` unique; `mail_queue` with `id`, `to`, `subject`, `text`, `html`, `attempts` default 0, `send_after`, `created_at`). No `attachment_path` and no `sent_at`: sent rows are deleted (M5 adds the attachment column for backups).
- Produces `db/index.ts`: `type Db` (the Drizzle instance), `openDb(dataDir: string): Db` (creates the directory, opens `app.db`, sets `journal_mode = WAL`, `foreign_keys = ON`, runs the Drizzle migrator on `drizzle/`, resolved relative to `process.cwd()`), `getDb(): Db` (process-wide singleton from `readConfig().dataDir`), `closeDb()` for tests.

- [ ] **Step 1: Write failing tests**
  - `config.test.ts`: `readConfig({})` gives `dataDir` `./data`, `mailMaxPerHour` 60, `altchaMaxNumber` 100000, `trustProxy` false, `smtp` undefined; `SMTP_PORT=465 SMTP_SECURE=true` parses to `{ port: 465, secure: true }`; `signingEnabled` is false unless `SMTP_HOST`, `MAIL_FROM` and `SESSION_SECRET` are all present; `MAIL_MAX_PER_HOUR=abc` throws with the variable name in the message.
  - `db.test.ts`: `openDb(tmp)` creates `app.db` with tables `signatures`, `email_tokens`, `mail_queue`; opening the same directory twice applies migrations once (no error); inserting two signatures with the same `(provider, provider_subject)` throws a `SQLITE_CONSTRAINT_UNIQUE` error.
  - `healthz.test.ts`: still 200 `ok` with a temporary `DATA_DIR`.
- [ ] **Step 2: Run** `npm test` → new tests FAIL.
- [ ] **Step 3: Implement** config, schema, `npm run db:generate` (commit the generated SQL and `meta/`), `openDb`/`getDb`, healthz. Vitest: a `setupFiles` entry that sets `process.env.DATA_DIR` to a fresh `mkdtemp` directory per test file and calls `closeDb()` after all tests.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Verify the image** `podman build --format docker -t giantsmanifesto .` (repo root), then `podman run --rm -d -p 3000:3000 -v gm-data:/data --name gm giantsmanifesto`, `curl localhost:3000/healthz` → `ok`, `podman exec gm ls /data` lists `app.db`, `podman stop gm`. This proves better-sqlite3's native module and the migrations folder work in the runtime image. Note the result in the report.
- [ ] **Step 6: Commit** `git add -A .. && git commit -m "Add SQLite database with migrations and local dev environment"`

### Task 2: Email tokens and address hashing

**Files:**
- Create: `site/src/lib/email.ts`, `site/src/lib/tokens.ts`
- Test: `site/tests/unit/email.test.ts`, `site/tests/unit/tokens.test.ts`

**Interfaces:**
- Consumes: `Db`, `emailTokens` (Task 1).
- Produces `email.ts`: `normalizeEmail(raw: string): string`, `hashEmail(raw: string): string`, `isValidEmail(raw: string): boolean` (one `@`, non-empty local part, domain with a dot, no whitespace, max 254 characters).
- Produces `tokens.ts`: `type TokenPurpose = 'sign' | 'withdraw'` (M4 adds `org_confirm`); `TOKEN_TTL_MS = 48 * 60 * 60 * 1000`; `createToken(db: Db, purpose: TokenPurpose, payload: unknown, now?: number): string` (returns the raw token); `peekToken<T>(db, raw: string, purpose, now?): { ok: true; payload: T } | { ok: false; reason: 'invalid' | 'expired' | 'used' }`; `consumeToken<T>(db, raw, purpose, now?)` with the same result type, marking `used_at` inside a transaction so two concurrent consumes yield one `ok`; `deleteStaleTokens(db, now?): number` (deletes expired and used tokens).

- [ ] **Step 1: Write failing tests**
  - `normalizeEmail('  Ada@Example.ORG ')` → `ada@example.org`; `hashEmail` of both spellings is equal and 64 hex characters; `isValidEmail` rejects `''`, `'a@b'`, `'a b@c.de'`, `'@c.de'`, a 255-character address; accepts `'a.b+tag@sub.example.co.uk'`.
  - Tokens: the stored `token_hash` differs from the raw token; `peekToken` returns the payload and does not mark it used; `consumeToken` succeeds once, the second call returns `used`; a token of purpose `sign` peeked as `withdraw` returns `invalid`; at `now = created + TOKEN_TTL_MS + 1` the result is `expired`; an unknown or malformed token returns `invalid` without throwing; `deleteStaleTokens` removes the used and the expired token and keeps a fresh one.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** with `node:crypto` (`randomBytes(32).toString('base64url')`, `createHash('sha256')`).
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Add hashed single-use email tokens"`

### Task 3: Mail queue, templates and worker

**Files:**
- Modify: `site/package.json` (deps `nodemailer`; dev dep `@types/nodemailer`)
- Create: `site/src/lib/mail/queue.ts`, `site/src/lib/mail/templates.ts`, `site/src/lib/mail/transport.ts`, `site/src/lib/mail/worker.ts`
- Create: `site/src/middleware.ts` (starts the worker once per process when signing is enabled; also runs `deleteStaleTokens` once a day)
- Modify: `site/src/i18n/en.json` (`mail.*` strings)
- Test: `site/tests/unit/mail-queue.test.ts`, `site/tests/unit/mail-templates.test.ts`

**Interfaces:**
- Consumes: `Db`, `mailQueue`, `readConfig`, `signingEnabled`, `deleteStaleTokens`, `t()`.
- Produces `queue.ts`: `interface OutgoingMail { to: string; subject: string; text: string; html: string }`; `enqueueMail(db, mail: OutgoingMail, now?): void`; `type SendFn = (mail: OutgoingMail) => Promise<void>`; `processQueue(db, send: SendFn, opts: { now: number; maxPerHour: number; sentTimestamps: number[] }): Promise<{ sent: number; failed: number }>`. `sentTimestamps` holds the times of successful sends; `processQueue` drops entries older than 60 minutes and pushes one per success. `worker.ts` owns one array per process; there is no extra table. Due rows are those with `send_after <= now`, oldest first, at most `maxPerHour - sentTimestamps.length`. Success deletes the row. Failure increments `attempts` and sets `send_after = now + 2^attempts minutes`; at 8 attempts the row is deleted and an error is logged without the address.
- Produces `templates.ts`: `signConfirmMail(lang: Locale, to: string, link: string, name: string): OutgoingMail`, `withdrawMail(lang, to, link): OutgoingMail`. Plain text plus minimal HTML (one paragraph, the link, a sign-off), all text from `mail.*`, every interpolated value HTML-escaped in the HTML part.
- Produces `transport.ts`: `createSend(config: Config): SendFn` (nodemailer SMTP transport from `config.smtp`, `from: config.mailFrom`).
- Produces `worker.ts`: `startMailWorker(db, send, config): () => void` (runs `processQueue` every 30 seconds, never overlapping runs; returns a stop function).

- [ ] **Step 1: Write failing tests** (`send` is a `vi.fn()`):
  - Three due mails, `maxPerHour: 2` → `send` called twice, one row left; with `sentTimestamps` holding 2 entries from 10 minutes ago → nothing sent; entries older than 60 minutes don't count.
  - A failing `send` → row stays with `attempts` 1 and `send_after = now + 2 min`; after the 8th failure the row is gone; a mail with `send_after` in the future is not sent.
  - A successful send deletes the row (no address remains in the database).
  - Templates: `signConfirmMail('en', 'a@b.de', 'https://x/en/sign/confirm?token=abc', '<Ada>')` has the link in text and HTML, the name escaped as `&lt;Ada&gt;` in HTML, a non-empty subject from `mail.signConfirm.subject`.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement.** In `middleware.ts`, guard with a module-level flag so the worker starts once; skip entirely when `signingEnabled(readConfig())` is false; pass requests through unchanged.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Add mail queue with hourly cap, backoff and SMTP worker"`

### Task 4: Abuse protection and origin check behind the proxy

**Files:**
- Modify: `site/package.json` (deps `altcha-lib`, `altcha`)
- Create: `site/src/lib/security/client-ip.ts`, `site/src/lib/security/rate-limit.ts`, `site/src/lib/security/altcha.ts`
- Create: `site/src/pages/api/altcha.ts` (GET → JSON challenge, `Cache-Control: no-store`)
- Create: `site/src/components/Altcha.astro` (renders `<altcha-widget challengeurl="/api/altcha" name="altcha">`, imports the `altcha` package in a client `<script>` so Vite bundles it, sets the widget's strings from `t()` via its `strings` attribute, and hides the "Protected by ALTCHA" footer link; the widget must not contact any other origin)
- Create: `site/src/components/Honeypot.astro` (a visually hidden field `website`, `tabindex="-1"`, `autocomplete="off"`, label "Leave this field empty", `aria-hidden` on its wrapper)
- Modify: `site/astro.config.mjs` (`security: { checkOrigin: true, allowedDomains: [{ hostname: <SITE_URL host>, protocol: 'https' }] }`, derived from `SITE_URL`; omit `allowedDomains` when `SITE_URL` is `http://…` so local runs still work)
- Test: `site/tests/unit/client-ip.test.ts`, `site/tests/unit/rate-limit.test.ts`, `site/tests/unit/altcha.test.ts`, `site/tests/e2e/origin.spec.ts`

**Interfaces:**
- Produces `client-ip.ts`: `clientIp(request: Request, clientAddress: string, trustProxy: boolean): string`.
- Produces `rate-limit.ts`: `class RateLimiter { constructor(limit: number, windowMs: number); hit(key: string, now?: number): boolean }` (true = allowed; fixed window; drops expired keys while counting so memory stays bounded); exported instances `formLimiter = new RateLimiter(10, 15 * 60 * 1000)`.
- Produces `altcha.ts`: `createAltchaChallenge(config: Config): Promise<Challenge>` (HMAC key `SESSION_SECRET`, `maxnumber: config.altchaMaxNumber`, expires in 10 minutes); `verifyAltcha(payload: string | null, config: Config, now?: number): Promise<boolean>` (false for missing/invalid/expired payloads; remembers verified signatures until expiry and rejects a replay).
- Produces a shared form guard: `checkFormGuards(form: FormData, ip: string, config: Config): Promise<'ok' | 'honeypot' | 'rate_limited' | 'altcha'>` in `site/src/lib/security/guards.ts` (honeypot `website` non-empty → `honeypot`; then rate limit; then ALTCHA). Pages treat `honeypot` like success without side effects.

- [ ] **Step 1: Write failing tests**
  - `clientIp`: `trustProxy=false` → socket address even with an `X-Forwarded-For` header; `trustProxy=true` with `X-Forwarded-For: 1.1.1.1, 2.2.2.2` → `2.2.2.2`; `trustProxy=true` without the header → socket address.
  - `RateLimiter(2, 1000)`: third hit in the window is false, a hit after the window is true again, different keys are independent.
  - ALTCHA: solve a challenge created with `ALTCHA_MAX_NUMBER=1000` using `altcha-lib`'s `solveChallenge`, build the base64 payload → `verifyAltcha` true; the same payload again → false; a tampered payload → false; `null` → false; at `now` past expiry → false.
  - The `astro.config.mjs` change has no POST route to test against yet; its e2e test (`origin.spec.ts`) is written in Task 5.
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm test` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Add honeypot, per-IP rate limits, ALTCHA and proxy-aware origin check"`

### Task 5: Sign by email

**Files:**
- Create: `site/src/lib/countries.ts` (`COUNTRY_CODES: readonly string[]`, the ISO 3166-1 alpha-2 codes of the 249 assigned countries and territories; `countryName(code: string, lang: Locale): string` via `Intl.DisplayNames`; `countryOptions(lang): { code: string; name: string }[]` sorted by name with `localeCompare`)
- Create: `site/src/lib/signatures.ts`
- Create: `site/src/lib/forms/signature-input.ts`
- Create: `site/src/pages/[lang]/sign/index.astro`, `site/src/pages/[lang]/sign/check-email.astro`, `site/src/pages/[lang]/sign/confirm.astro`, `site/src/pages/[lang]/sign/thanks.astro`
- Modify: `site/src/i18n/en.json` (`sign.*`, `form.*` for shared labels and errors)
- Modify: `site/src/styles/global.css` (`.form`, `.field`, `.field-error`, `.notice`)
- Create: `site/src/pages/500.astro` (spec 6.8: generic error page with a link home; the middleware from Task 3 catches errors from `next()`, logs `error.name`/`message`/stack plus method and path without query string, and rethrows so Astro renders this page)
- Modify: `site/playwright.config.ts` (web server env: `SITE_URL=https://giantsmanifesto.org`, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `MAIL_FROM=contact@giantsmanifesto.org`, `SESSION_SECRET=test-secret`, `ALTCHA_MAX_NUMBER=1000`, `DATA_DIR` a fresh temp directory)
- Modify: `.github/workflows/ci.yml` (e2e job: `services: mailpit: image: axllent/mailpit, ports: ['1025:1025', '8025:8025']`)
- Create: `site/tests/e2e/mailpit.ts` (helpers `clearMailbox()`, `latestMailTo(address): Promise<{ subject: string; text: string }>` polling `http://127.0.0.1:8025/api/v1/` for up to 45 seconds)
- Test: `site/tests/unit/signature-input.test.ts`, `site/tests/unit/signatures.test.ts`, `site/tests/unit/countries.test.ts`, `site/tests/e2e/sign.spec.ts`, `site/tests/e2e/origin.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces `signature-input.ts`: `interface SignatureInput { displayName: string; affiliation: string; country: string; email: string; consent: boolean }`; `parseSignatureForm(form: FormData): { ok: true; value: SignatureInput } | { ok: false; errors: Partial<Record<'displayName' | 'affiliation' | 'country' | 'email' | 'consent', string>>; values: SignatureInput }` (errors are i18n keys under `form.errors.*`).
- Produces `signatures.ts`: `interface PublicSignature { id: number; displayName: string; affiliation: string | null; country: string | null; provider: string; profileUrl: string | null; createdAt: number }`; `createEmailSignature(db, pending: PendingEmailSignature, now?): { created: true; id: number } | { created: false; existingId: number }`; `findByEmailHash(db, emailHash: string): PublicSignature | undefined`; `deleteSignature(db, id: number): void`; `countSignatures(db): number` and `listSignatures(db, opts: { query?: string; page: number; pageSize: number }): { items: PublicSignature[]; total: number }` (both exclude `hidden`; newest first; `query` matches `display_name` or `affiliation` with `LIKE`, `%` and `_` escaped). `PendingEmailSignature = { displayName; affiliation; country; emailHash; manifestoVersion; consentAt }` is the `sign` token payload.
- Flow (spec 6.2): `/sign` GET renders the form (or the paused notice when `!signingEnabled`). POST → `checkFormGuards` → `parseSignatureForm` → `createToken(db, 'sign', pending)` → `enqueueMail(signConfirmMail(...link to /en/sign/confirm?token=…))` → 303 to `/en/sign/check-email`. On errors: re-render with values, field errors (`aria-describedby`, `aria-invalid`) and an error summary at the top that receives focus. `rate_limited` and `altcha` failures show a form-level message.
- `/sign/confirm` GET: `peekToken` → valid: summary of name/affiliation/country and a "Confirm signature" POST button; `used`: "This link was already used" + link to `/en/signatures`; `expired`/`invalid`: message + link back to `/en/sign`. POST: `consumeToken` → `createEmailSignature` → 303 to `/en/sign/thanks` (or `?already=1` when it existed). A POST with a used token shows the same "already used" message, status 200.
- `/sign/thanks`: thanks text, link to `/en/signatures`; with `already=1`: "You have already signed." All four pages `noindex`.

- [ ] **Step 1: Write failing tests**
  - `signature-input`: valid input passes and trims; empty name, an 81-character name, `country=XX`, invalid email and missing consent each produce exactly their error key; a name of only spaces is empty.
  - `signatures`: `createEmailSignature` twice with the same `emailHash` → second returns `{ created: false, existingId }`, one row; `countSignatures` and `listSignatures` skip a hidden row; `listSignatures` with `query: '50%'` matches only a literal `50%`; pages are newest first.
  - `countries`: 249 unique two-letter codes; `countryName('DE','en')` is `Germany`; `countryOptions('en')[0].name` sorts before `[1].name`.
  - `sign.spec.ts` (Mailpit): fill the form, wait for the ALTCHA widget to verify, submit → check-email page; the mail to the address arrives; open the link → summary shown, **the signature list does not contain the name yet** (GET doesn't sign); click Confirm → thanks page; `/en/signatures` lists the name; reload the confirm link → "already used"; sign again with the same address in different case → after confirming, "You have already signed"; a form with an invalid email shows the error summary with focus and keeps the entered name; the honeypot filled → check-email page shown but no mail arrives within 5 seconds.
  - `origin.spec.ts` (Playwright `request` fixture, form POST to `/en/sign`): with `Origin: https://giantsmanifesto.org`, `X-Forwarded-Proto: https` and `X-Forwarded-Host: giantsmanifesto.org` → not 403; with `Origin: https://evil.example` → 403 (Review Focus 1).
  - Extend `accessibility.spec.ts` with `/en/sign`, `/en/sign/check-email`, and the sign form with errors shown.
- [ ] **Step 2: Run** `npm test && npm run test:e2e -- sign origin` (Mailpit running: `podman run --rm -d -p 1025:1025 -p 8025:8025 --name mailpit axllent/mailpit`) → FAIL.
- [ ] **Step 3: Implement.** `[lang]` pages here use `export const prerender = false` with `getStaticPaths` removed; reject unknown `lang` with a 404 via `isLocale`.
- [ ] **Step 4: Run** all checks and `npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Add signing by confirmed email"`

### Task 6: Withdraw by email

**Files:**
- Create: `site/src/pages/[lang]/withdraw/index.astro`, `site/src/pages/[lang]/withdraw/check-email.astro`, `site/src/pages/[lang]/withdraw/confirm.astro`, `site/src/pages/[lang]/withdraw/done.astro`
- Modify: `site/src/i18n/en.json` (`withdraw.*`)
- Test: `site/tests/e2e/withdraw.spec.ts`

**Interfaces:**
- Consumes: `checkFormGuards`, `isValidEmail`, `hashEmail`, `findByEmailHash`, `deleteSignature`, `createToken`/`peekToken`/`consumeToken` (purpose `withdraw`, payload `{ emailHash }`), `withdrawMail`, `enqueueMail`, `Altcha.astro`, `Honeypot.astro`.
- Flow (spec 6.3, email path): `/withdraw` form with email (+ honeypot, ALTCHA). POST → if a signature exists for the hash, create a token and queue `withdrawMail`; in **every** valid case 303 to `/en/withdraw/check-email`, whose text says "If a signature exists for this address, we sent a link". `/withdraw/confirm` GET shows the matching signature and a "Delete my signature" POST button; POST consumes the token, deletes the row, 303 to `/en/withdraw/done`. Token valid but signature already gone → `done`. All pages `noindex`; paused notice when `!signingEnabled`.

- [ ] **Step 1: Write failing e2e tests:** sign (reuse helpers from `sign.spec.ts`, moved to a shared fixture file), withdraw → mail arrives → link shows the signature → GET alone leaves it in `/en/signatures` → Delete → `/en/signatures` no longer lists it; withdraw for an address that never signed → identical check-email page and no mail within 5 seconds; a used withdraw link → "already used". Add `/en/withdraw` to the axe pages.
- [ ] **Step 2: Run** `npm run test:e2e -- withdraw` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all checks and `npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Add withdrawing a signature by email link"`

### Task 7: Public list, homepage, navigation, privacy and operator docs

**Files:**
- Create: `site/src/pages/[lang]/signatures.astro` (server-rendered: count, search form `GET ?q=`, 50 per page with Previous/Next links, each entry: name, affiliation, country name, date, badge "Email confirmed" (`signatures.badge.email`); empty and no-results states)
- Modify: `site/src/pages/[lang]/index.astro` (server-rendered; under the values: "Sign the manifesto" primary button to `/en/sign`, the count "{count} people have signed" (`home.count`, with a singular form for 1 and a "Be the first to sign" text for 0), "Read the full text" as a text link; below, the 5 newest signatures and a link "All signatures"; when `!signingEnabled`, the button reads "Signing opens soon" and is a plain text notice, not a link)
- Modify: `site/src/components/Header.astro` (nav: Manifesto, Signatures, Changelog, Contact)
- Modify: `site/content/legal/privacy.en.md` (under "What this website stores": what a signature stores and publishes, that the email address is only used to send the confirmation and is kept only as a one-way hash, that pending confirmations expire after 48 hours, how to withdraw; mark the new paragraphs with an HTML comment `<!-- needs legal review -->`)
- Modify: `docs/deploy-coolify.md` (before signing goes live: add a persistent volume `/data`; env vars `SESSION_SECRET` (e.g. `openssl rand -hex 32`), `SMTP_*`, `MAIL_FROM`; signing stays paused until they are set; how to check with `/healthz` and a test signature)
- Modify: `docs/specs/2026-11-13-giantsmanifesto-website-design.md` section 9, CI bullet: replace the deploy-webhook sentence with "Coolify deploys every push to `main` via a GitHub webhook; the `main` ruleset requires green `check` and `e2e` before merging."
- Modify: `README.md` (`docker compose up` / `podman compose up` for app + Mailpit, Mailpit UI at `http://localhost:8025`)
- Test: `site/tests/e2e/signatures.spec.ts`, modify `content.spec.ts`, `accessibility.spec.ts`

**Interfaces:**
- Consumes: `countSignatures`, `listSignatures`, `countryName`, `signingEnabled`.

- [ ] **Step 1: Write failing tests**
  - `signatures.spec.ts`: seed signatures directly into the e2e `DATA_DIR` database (a helper that opens it with `openDb`), including one hidden and one named `<script>alert(1)</script>`: the list shows the visible ones newest first with the badge and the country name, never the hidden one, and renders the script name as text; search for an affiliation narrows the list; with 51 seeded rows, page 2 has 1 entry and a Previous link; `?page=999` shows the empty state, not an error; `?page=abc` is treated as page 1.
  - `content.spec.ts`: homepage shows the Sign button linking to `/en/sign`, a count equal to `countSignatures()` read from the e2e database at test time (other specs add signatures to the same database, so never assert a fixed number), the newest 5 names; nav has the four items in order.
  - A test with a web server started **without** SMTP env (second Playwright project or a separate config `playwright.paused.config.ts` on port 4323): homepage shows "Signing opens soon", `/en/sign` shows the paused notice and a POST to it does not create a token.
  - Add `/en/signatures` (with and without results) to the axe pages.
- [ ] **Step 2: Run** `npm run test:e2e` → FAIL.
- [ ] **Step 3: Implement.** Update the existing homepage/hero tests in `identity.spec.ts` only where the new elements move things; the drawing must still not overlap text.
- [ ] **Step 4: Run** all checks and the full `npm run test:e2e` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Show signatures and count, add navigation and operator docs"`

---

## After the plan

- Open one PR for the branch; CI must be green (e2e now runs with Mailpit). Merging deploys with signing **paused** until the volume, `SESSION_SECRET` and SMTP settings are configured in Coolify (`docs/deploy-coolify.md`).
- Then: one real signature and withdrawal on production, and a mail-tester.com check (SPF/DKIM/DMARC docs follow in M5).
- Reminder for the initiator: move Coolify to HTTPS and close port 8000.
