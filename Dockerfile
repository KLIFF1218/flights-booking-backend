FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.14.0 --activate && \
    apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont

ENV NPM_CONFIG_FETCH_TIMEOUT=120000
ENV NPM_CONFIG_FETCH_RETRIES=5

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

FROM base AS builder

WORKDIR /app

ENV CI=true
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack install && pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate
RUN pnpm build

FROM base AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

ENV NODE_ENV=production
ENV HTTP_PORT=3001
ENV CI=true
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack install && pnpm install --prod --frozen-lockfile && \
    pnpm store prune

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nodejs:nodejs /app/scripts/docker-migrate.sh ./scripts/docker-migrate.sh
COPY --from=builder --chown=nodejs:nodejs /app/scripts/docker-entrypoint.prod.sh ./docker-entrypoint.sh

RUN pnpm exec prisma generate && chown -R nodejs:nodejs /app/node_modules

RUN chmod +x /app/docker-entrypoint.sh /app/scripts/docker-migrate.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health/ready', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

USER nodejs
EXPOSE 3001

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]

FROM builder AS development

ENV NODE_ENV=development
WORKDIR /app

COPY scripts/docker-entrypoint.dev.sh /app/docker-entrypoint.dev.sh
COPY scripts/docker-migrate.sh /app/scripts/docker-migrate.sh

RUN chmod +x /app/docker-entrypoint.dev.sh /app/scripts/docker-migrate.sh

HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health/ready', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.dev.sh"]
