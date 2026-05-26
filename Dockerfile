FROM node:22-alpine AS builder
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate
RUN pnpm build

FROM node:22-alpine AS production
RUN corepack enable

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

ENV NODE_ENV=production
ENV PORT=3001

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile && \
    pnpm store prune

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })"

USER nodejs
EXPOSE 3001

CMD ["node", "dist/main.js"]

FROM builder AS development
ENV NODE_ENV=development
WORKDIR /app

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })"

EXPOSE 3001
CMD ["pnpm", "start:dev"]
