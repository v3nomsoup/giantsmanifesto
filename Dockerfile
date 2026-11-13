FROM node:22-bookworm-slim AS build
WORKDIR /repo/site
COPY site/package.json site/package-lock.json ./
RUN npm ci
COPY Shoulders-of-Giants-Manifesto.md CHANGELOG.md /repo/
COPY site/ ./
ARG SITE_URL=https://giantsmanifesto.org
ENV SITE_URL=$SITE_URL
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /repo/site
COPY Shoulders-of-Giants-Manifesto.md CHANGELOG.md /repo/
COPY --from=build /repo/site/package.json ./
COPY --from=build /repo/site/node_modules ./node_modules
COPY --from=build /repo/site/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/server/entry.mjs"]
