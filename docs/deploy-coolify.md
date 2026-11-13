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
