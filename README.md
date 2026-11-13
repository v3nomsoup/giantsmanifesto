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

## Running the container locally

Production builds the `Dockerfile` with Docker (via Coolify). Locally, [Podman](https://podman.io) works as an open source alternative. Podman 6 has no installer for Intel Macs; use the latest 5.8.x `podman-installer-macos-amd64.pkg` there.

```bash
podman machine init       # once: create the Linux VM
podman machine start
podman build --format docker -t giantsmanifesto .   # from the repo root
podman run --rm -d -p 3000:3000 --name giantsmanifesto giantsmanifesto
curl http://localhost:3000/healthz                  # ok
podman stop giantsmanifesto
podman machine stop       # when done
```

`--format docker` keeps the image's `HEALTHCHECK`; Podman's default OCI format drops it.
