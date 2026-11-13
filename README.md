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
