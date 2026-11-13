# giantsmanifesto.org — Website Design

Status: draft for review · Date: 2026-11-13

## 1. Goal

A website at `giantsmanifesto.org` that publishes the *Shoulders of Giants Manifesto*, collects public signatures from individuals and endorsements from organizations, and invites feedback that shapes future versions of the text.

Success means:

- The manifesto is easy to read and share.
- Signatures are credible: each one is tied to a verified account or a confirmed email address and shown publicly.
- Organizations can apply to be listed; only reviewed organizations appear.
- Feedback reaches the initiator and visibly flows into new, versioned releases of the text.
- Running costs stay close to zero; the site runs on the initiator's existing VPS.

## 2. Decisions

| Topic | Decision |
|---|---|
| Source of truth | `Shoulders-of-Giants-Manifesto.md` in the repo root; the site renders from it |
| Stack | Astro (TypeScript, Node adapter, standalone server) + SQLite (Drizzle ORM) |
| Hosting | Single Docker container on the initiator's VPS via Coolify |
| Sign-in for signing | GitHub, LinkedIn, Mastodon-API-compatible fediverse servers, Bluesky; email link as fallback |
| Signature visibility | Always public (name, optional affiliation and country, verification badge, profile link where available) |
| Organizations | Application → email confirmation at the organization's domain → manual approval |
| Feedback | Form on the site (stored, visible in admin) plus GitHub issues/PRs; public changelog |
| Languages | English in v1; all UI text in translation files; English text is authoritative |
| Email | SMTP via the registrar mailbox, sending and receiving |
| Backups | Nightly local copies plus a daily `age`-encrypted backup sent by email |
| Analytics | None in v1 |

## 3. Pages

All public pages live under a language prefix (`/en/…`). `/` redirects to `/en/`.

| Path | Content | Rendering |
|---|---|---|
| `/` | Core statement, "Sign" button, signature count; the four "We value" points; newest signatures and organization logos; "Who's behind this" section (anchor `#about`); links to full text, `/shape`, `/organizations` | server |
| `/manifesto` | Full text from the `.md`, table of contents, anchor link per section | static |
| `/sign` | Choose sign-in method → confirmation form → thank-you page with share links | server |
| `/signatures` | Public list, newest first, search, pagination, verification badge per entry | server |
| `/organizations` | Approved organizations (logo, name, link, optional statement) and the application form | server |
| `/shape` | Feedback form (optional section reference), link to GitHub issues/PRs, link to changelog | server |
| `/changelog` | Rendered from `CHANGELOG.md` | static |
| `/contact` | `contact@giantsmanifesto.org`, line "Initiated by Philipp Eckert" linking to `/#about` | static |
| `/withdraw` | Withdraw a signature | server |
| `/privacy`, `/imprint` | Privacy policy and legal notice; structure provided, content needs legal review | static |
| `/admin` | Organization applications, signatures, feedback | server, protected |

### "Who's behind this" (homepage, `#about`)

- Worded as "initiated by", not "author": the manifesto is a living document that belongs to its signers.
- Short bio: Philipp Eckert, AI automation expert, chair of Computerkunst e.V., stated as acting in a personal capacity. Links to `eckert.rocks` and `computerkunst.info`.
- One sentence on how the text evolves: feedback → new versions → changelog.
- If the Computerkunst e.V. board agrees, the association is listed as the first supporting organization instead of relying on the bio alone.

Footer and `/contact` link to `/#about`.

## 4. Repository layout

```
Shoulders-of-Giants-Manifesto.md   source of the manifesto text
CHANGELOG.md                       version history of the text
site/                              Astro app
  src/pages/                       routes
  src/lib/auth/                    one module per provider + email links
  src/lib/db/                      schema, migrations, queries
  src/lib/mail/                    queue, templates, SMTP
  src/lib/backup/                  local and email backups
  src/i18n/en.json                 UI and email text
Dockerfile
docker-compose.yml                 local dev: app + Mailpit
.env.example                       documented config, no values
docs/
  specs/                           this document
  mail-dns-setup.md                SPF, DKIM, DMARC
  backup-restore.md                age key setup and restore
  launch-checklist.md              manual tests with real accounts
```

## 5. Data model (SQLite)

Database at `/data/app.db`, logos in `/data/logos/`, both on a persistent Coolify volume.

### `signatures`

| Field | Notes |
|---|---|
| `id`, `created_at` | |
| `display_name` | public; pre-filled from the provider, editable before submitting |
| `affiliation`, `country` | optional, public |
| `provider` | `github` · `linkedin` · `mastodon` · `bluesky` · `email` |
| `provider_subject` | stable account ID: GitHub user ID, LinkedIn `sub`, Mastodon `acct@server`, Bluesky DID; for email a SHA-256 hash of the normalized address, never the address |
| `profile_url` | public; empty for LinkedIn and email |
| `manifesto_version` | e.g. `0.1` |
| `consent_at` | time of consent to publication |
| `hidden` | set by admin |

Unique on `(provider, provider_subject)`.

### `organizations`

| Field | Notes |
|---|---|
| `id`, `created_at`, `reviewed_at` | |
| `name`, `website`, `logo_file`, `statement` | public once approved |
| `contact_name`, `contact_email` | never public; email domain must match the website domain |
| `status` | `awaiting_email` → `awaiting_review` → `approved` / `rejected` |

### `feedback`

`id`, `created_at`, `section` (optional anchor such as `principles-iii`), `message`, optional `name` and `email`, `manifesto_version`, `status` (`new` / `done`).

### Technical tables

- `email_tokens`: `token_hash`, `purpose` (`sign`, `withdraw`, `org_confirm`), `payload` (JSON), `expires_at`, `used_at`. Pending email signatures live here until confirmed.
- `mail_queue`: `to`, `subject`, `text`, `html`, `attachment_path`, `attempts`, `send_after`, `sent_at`.
- `mastodon_apps`: `server`, `client_id`, `client_secret`, `created_at`.
- `atproto_state`, `atproto_session`: key/value stores required by the Bluesky OAuth client.
- `admin_sessions`: `id_hash`, `github_id`, `expires_at`.

### Data minimization and retention

- No avatars and no provider access tokens are stored.
- Feedback `name` and `email` are deleted when the item is marked `done`.
- Rejected organizations are deleted 30 days after review.
- Expired and used `email_tokens` are deleted daily.
- Withdrawn signatures are deleted completely.
- Logos: PNG, JPEG or WebP only, max. 1 MB, re-encoded server-side (sharp) to WebP. SVG is not accepted.

## 6. Flows

### 6.1 Signing via a provider

1. `/sign`: the person chooses GitHub, LinkedIn, Mastodon (enters server or `@user@server`) or Bluesky (enters handle).
2. Redirect to the provider with `state` and PKCE.
3. Callback fetches the minimal identity:
   - GitHub: no scopes; user ID, login, name, profile URL.
   - LinkedIn: OpenID Connect, scopes `openid profile` (no email); `sub` and name.
   - Mastodon: on first contact with a server, register the app via `POST /api/v1/apps` and store it in `mastodon_apps`; scope `read:accounts`; `verify_credentials` gives `acct`, display name, profile URL.
   - Bluesky: `@atproto/oauth-client-node`; DID and handle from the session, display name from the public profile.
4. Provider tokens are discarded (revoked where supported). The identity is stored in a signed, HTTP-only cookie valid for 15 minutes.
5. Confirmation form: name (editable), optional affiliation and country, required checkbox: "I agree that my name, affiliation, country and profile link will be published on this site."
6. Submit creates the signature. If `(provider, provider_subject)` already exists, the page says so and links to the existing entry.
7. Thank-you page with share links (Mastodon, Bluesky, LinkedIn, copy link).

### 6.2 Signing via email

1. Form: name, optional affiliation and country, email, consent checkbox.
2. A confirmation email with a link valid for 48 hours is queued.
3. The link opens a page with a "Confirm signature" button; the signature is created only on POST, so mail scanners that open links don't confirm.
4. The signature is stored with the email hash; the token is marked used.

### 6.3 Withdrawing

`/withdraw`: sign in again with the same provider, or request an email link. The page shows the matching signature and a "Delete" button; deletion removes the row.

### 6.4 Organization application

1. Form: organization name, website, optional logo and statement, contact name and email.
2. Validation: the email's registrable domain (eTLD+1, via the Public Suffix List) must equal the website's registrable domain.
3. Confirmation link to the contact email (48 hours). On confirmation, status becomes `awaiting_review` and the admin gets an email.
4. Admin approves or rejects in `/admin`. On approval the contact gets a "You're now listed" email; on rejection a short neutral email.

### 6.5 Feedback

Form on `/shape` (optionally pre-filled with a section when opened from a section anchor link on `/manifesto`). Stored as `new`; no confirmation step.

### 6.6 Admin

`/admin` uses GitHub sign-in. Access only if the GitHub user ID is in `ADMIN_GITHUB_IDS`. Session cookie valid for 7 days. Views:

- Organizations awaiting review: approve / reject.
- Signatures: search, hide / unhide.
- Feedback: read, mark done.

### 6.7 Abuse protection

- Honeypot field on all public forms.
- In-memory rate limits per IP on sign-in starts and form submissions.
- ALTCHA proof-of-work challenge (self-hosted) on email signing, organization applications and feedback.
- `SameSite=Lax` cookies and Astro's origin check against cross-site form posts.

### 6.8 Error handling

Cancelled provider login, unreachable or non-Mastodon-API server, unknown Bluesky handle, expired or used links: the person returns to `/sign` (or the relevant form) with a clear message and the alternative methods. Unexpected errors show a generic error page and are logged without personal data.

## 7. Email

- SMTP via the registrar mailbox using `nodemailer`. Sender `contact@giantsmanifesto.org` (or a `noreply@` alias if the plan allows).
- An in-process worker sends from `mail_queue`, respecting `MAIL_MAX_PER_HOUR`, with exponential backoff on failure (max. 8 attempts).
- Templates in plain text plus simple HTML; text comes from the translation files.
- `docs/mail-dns-setup.md` covers SPF, DKIM and DMARC records at the registrar and testing with mail-tester.com.

## 8. Deployment and operations

- Multi-stage `Dockerfile` (Node 22) builds the Astro standalone server.
- Coolify app from the GitHub repo; HTTPS via Let's Encrypt for `giantsmanifesto.org`, `www.` redirects to the apex domain.
- Persistent volume mounted at `/data`.
- Configuration via Coolify environment variables only; `.env.example` lists them without values: `SITE_URL`, `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `MAIL_MAX_PER_HOUR`, `ADMIN_GITHUB_IDS`, `ADMIN_EMAIL`, `BACKUP_AGE_RECIPIENT`, `BACKUP_EMAIL`, `BACKUP_MAX_ATTACHMENT_MB`.
- Drizzle migrations run on startup.
- `/healthz` for Coolify's health check.
- Manifesto updates: edit `Shoulders-of-Giants-Manifesto.md` and `CHANGELOG.md`, push; the site rebuilds. The version is parsed from the `*Version X.Y · …*` line.
- Logs go to stdout without IP or email addresses.

### Backups

- Nightly: `sqlite3 .backup` plus `/data/logos` into `/data/backups/`, keeping the last 14.
- Daily email backup: `tar.gz` of database and logos, encrypted with `age` to the public key in `BACKUP_AGE_RECIPIENT`, sent to `BACKUP_EMAIL` (a mailbox at a different provider than the registrar). If the archive exceeds `BACKUP_MAX_ATTACHMENT_MB` (default 10), only the database is sent and the email says logos were skipped.
- The server never holds a key that can decrypt backups. `docs/backup-restore.md` covers key generation and restore (`age -d -i key.txt backup.tar.gz.age | tar xz`).

## 9. Testing

- **Unit (Vitest):** domain matching (subdomains, lookalikes such as `example.de.evil.com`), token hashing/expiry/single use, version parsing, mail queue rate limiting and backoff, backup encrypt/decrypt round trip with a test key.
- **Integration (Vitest + temporary SQLite + MSW):** each provider flow with mocked provider responses, duplicate signature, email sign with valid/expired/reused link, withdrawal, organization flow through approval, feedback, admin access denied without allowlist.
- **End-to-end (Playwright):** read manifesto; email signing with Mailpit; organization application → admin approval → logo visible; axe accessibility checks on all public pages.
- **Manual launch checklist:** sign and withdraw once with real GitHub, LinkedIn, Mastodon and Bluesky accounts.
- **CI (GitHub Actions):** lint, type check, unit and integration tests on every push and PR; E2E on PRs. After green tests on `main`, the workflow calls Coolify's deploy webhook; Coolify's own auto-deploy is disabled.
- **Local dev:** `docker compose up` runs the app and Mailpit.

## 10. Out of scope for v1

- Translations of the manifesto (structure is prepared).
- Public comments or discussion on the site.
- Analytics.
- Fediverse servers without the Mastodon API (e.g. Misskey).
- Avatars on signatures.

## 11. Open items for the initiator

- Buy `giantsmanifesto.org` and set up the `contact@` mailbox.
- Create a LinkedIn company page for the manifesto (required for a LinkedIn app) and verify LinkedIn's current OIDC terms.
- Check the registrar's SMTP sending limits.
- Choose a backup mailbox at a different provider and generate an `age` key pair.
- Ask the Computerkunst e.V. board whether the association wants to be listed as a supporter.
- Have `/privacy` and `/imprint` content reviewed legally.
