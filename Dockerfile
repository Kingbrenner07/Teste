FROM node:22-bookworm-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
    && apt-get install --no-install-recommends -y chromium ca-certificates gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY tsconfig.json tsconfig.base.json ./

RUN corepack enable && pnpm install --frozen-lockfile \
    && pnpm --filter @workspace/api-server run build \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app \
    && chown -R app:app /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]

# The schema push is idempotent and makes a new managed PostgreSQL database
# ready before the API accepts traffic.
CMD ["sh", "-c", "pnpm --filter @workspace/db run push && node --enable-source-maps artifacts/api-server/dist/index.mjs"]