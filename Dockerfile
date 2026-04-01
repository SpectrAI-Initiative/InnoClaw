# ── Stage 1: Install dependencies ──────────────────────────────────
FROM node:24-slim AS deps

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Install drizzle-kit separately so we can copy it to the runner later.
# This reuses the build-tool environment needed by better-sqlite3.
RUN npm install --no-save drizzle-kit

# ── Stage 2: Build the application ────────────────────────────────
FROM node:24-slim AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────
FROM node:24-slim AS runner

RUN apt-get update && \
    apt-get install -y --no-install-recommends tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system nodejs && adduser --system --ingroup nodejs nextjs

# Copy standalone server output (includes traced node_modules with better-sqlite3)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Drizzle migrations + config so the entrypoint can auto-migrate
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy pre-built drizzle-kit and its deps from the deps stage (native modules already compiled)
COPY --from=deps /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
# drizzle-orm and better-sqlite3 are already in node_modules from standalone trace;
# ensure they exist (standalone may place them in nested paths)
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Copy entrypoint
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Prepare data directory
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENTRYPOINT ["tini", "--"]
CMD ["/docker-entrypoint.sh"]
