import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL ?? 'https://giantsmanifesto.org';
const siteUrl = new URL(site);

// Behind Traefik the node server sees http://, while browsers post from https://. Astro only
// trusts X-Forwarded-Proto/-Host (and so builds the https origin its origin check compares
// with) for hosts listed here. Plain-http SITE_URLs (local runs) skip it: no proxy there.
const allowedDomains =
  siteUrl.protocol === 'https:' ? [{ hostname: siteUrl.hostname, protocol: 'https' }] : undefined;

export default defineConfig({
  site,
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  trailingSlash: 'ignore',
  security: { checkOrigin: true, ...(allowedDomains && { allowedDomains }) },
});
