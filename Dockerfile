# Restify API - Node.js backend (Debian base for Prisma/OpenSSL compatibility)
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# OpenSSL para que Prisma detecte la versión correcta (doc Prisma Docker)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Forzar motor OpenSSL 3 en build (evita default openssl-1.1.x en slim)
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x
RUN npx prisma generate --schema=./src/core/infrastructure/database/prisma/schema.prisma
RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS runner

WORKDIR /app

# OpenSSL en runtime para que Prisma cargue el motor correcto (doc Prisma)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/core/infrastructure/database/prisma ./src/core/infrastructure/database/prisma

EXPOSE 3000

CMD ["node", "dist/server/server.js"]
