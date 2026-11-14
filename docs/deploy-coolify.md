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

## 3. Deploy on push to `main`

Coolify deploys every push to `main` through a GitHub webhook. The Coolify API stays off, and no deploy token is stored in GitHub.

1. In the application's **Webhooks** section, under **Manual Git Webhooks → GitHub**, copy the URL (`…/webhooks/source/github/events/manual`) and set a **GitHub Webhook Secret** (e.g. `openssl rand -hex 32`).
2. On GitHub, **Settings → Webhooks → Add webhook**: that URL as Payload URL, content type `application/json`, the same secret, "Just the push event".
3. Check that the ping under **Recent Deliveries** succeeded.

Coolify deploys whatever lands on `main`, whether CI passed or not. Changes go through pull requests, so a branch protection rule on `main` that requires the `check` and `e2e` checks keeps a red build from deploying.

## Updating the manifesto

Edit `Shoulders-of-Giants-Manifesto.md`, bump the `*Version X.Y · …*` line, add an entry to `CHANGELOG.md`, open a pull request. Once CI is green, merge it; Coolify deploys the merge.
