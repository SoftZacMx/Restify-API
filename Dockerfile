# Restify API - Node.js backend (Debian base for Prisma/OpenSSL compatibility)
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate --schema=./src/core/infrastructure/database/prisma/schema.prisma
RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/core/infrastructure/database/prisma ./src/core/infrastructure/database/prisma

EXPOSE 3000

CMD ["node", "dist/server/server.js"]
