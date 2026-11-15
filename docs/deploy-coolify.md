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
7. **Auto Deploy**: on (Configuration → Advanced).
8. Deploy once manually and open `https://giantsmanifesto.org/healthz`.

## 3. Before signing goes live

Signing and withdrawing stay **paused** (the pages show "Signing opens soon") until the steps below are done. Do them in this order.

1. **Persistent storage.** In the application's **Persistent Storage**, add a volume mounted at `/data`. Use a Docker **named volume** (Coolify's default "Volume Name"), or a host path that is owned by uid 1000 (`node`, the user the container runs as). Without a named volume (or host path) the data is not reliably kept across redeploys: the image only declares an anonymous volume, the deploy still goes live, and nothing warns you. A host path that is not owned by uid 1000 makes SQLite fail to open its database in `/data`, and `/healthz` answers 503. The database lives in `/data`, so with a proper volume it survives redeploys.
2. **Environment variables** (runtime, not build variables):
   - `SESSION_SECRET`: a long random value, for example the output of `openssl rand -hex 32`.
   - `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_SECURE` (`true` for port 465), `SMTP_USER`, `SMTP_PASSWORD`: the outgoing mail server.
   - `MAIL_FROM`: the sender address, for example `contact@giantsmanifesto.org`.
   - Optional: `MAIL_MAX_PER_HOUR` (default `60`), the cap on mails sent per hour.

   Signing is enabled only when `SMTP_HOST`, `MAIL_FROM` and `SESSION_SECRET` are all set.
3. **Redeploy**, then open `https://giantsmanifesto.org/healthz` (it must answer `ok`) and the homepage (it must show the Sign button, not "Signing opens soon"). Do one test signature with an address you control: sign, confirm through the mail link, check that you are in the list at `/en/signatures`, then withdraw it again at `/en/withdraw` and check that it is gone.
4. **Access logs.** Confirmation and withdrawal links carry a secret token in the URL. If Traefik access logs are enabled, they record those URLs; keep access logs off or short-lived.
5. **Proxy hops.** `TRUST_PROXY=1` (set in the Docker image) assumes exactly one proxy in front of the app, Traefik. The rate limits use the rightmost `X-Forwarded-For` entry. If a CDN or another proxy is ever put in front, revisit `clientIp` (`site/src/lib/security/client-ip.ts`) first, or every visitor may share one rate limit.

## 4. Deploy on push to `main`

Coolify deploys every push to `main` through a GitHub webhook. The Coolify API stays off, and no deploy token is stored in GitHub.

1. In the application's **Webhooks** section, under **Manual Git Webhooks → GitHub**, copy the URL (`…/webhooks/source/github/events/manual`) and set a **GitHub Webhook Secret** (e.g. `openssl rand -hex 32`).
2. On GitHub, **Settings → Webhooks → Add webhook**: that URL as Payload URL, content type `application/json`, the same secret, "Just the push event".
3. Check that the ping under **Recent Deliveries** succeeded.

Coolify deploys whatever lands on `main`, whether CI passed or not. Changes go through pull requests, so a branch protection rule on `main` that requires the `check` and `e2e` checks keeps a red build from deploying.

## Updating the manifesto

Edit `Shoulders-of-Giants-Manifesto.md`, bump the `*Version X.Y · …*` line, add an entry to `CHANGELOG.md`, open a pull request. Once CI is green, merge it; Coolify deploys the merge.
