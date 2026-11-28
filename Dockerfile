# App image. Expects a prebuilt base with Ubuntu + Node + build tools + tini:
#   .\scripts\docker-build-base.ps1
#   ./scripts/docker-build-base.sh
ARG BASE_IMAGE=innoscale-base:24.04-node24.22.3
ARG NPM_REGISTRY=https://registry.npmmirror.com
# Prebuilt binaries for the optional `canvas` package (GitHub releases are unreliable from mainland China).
ARG CANVAS_BINARY_HOST=https://registry.npmmirror.com/-/binary/canvas

# ── Stage 1: Install dependencies ──────────────────────────────────
FROM ${BASE_IMAGE} AS deps

ARG NPM_REGISTRY
ARG CANVAS_BINARY_HOST

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry "${NPM_REGISTRY}" && \
    npm_config_nodedir=/usr/local npm_config_canvas_binary_host="${CANVAS_BINARY_HOST}" npm ci && \
    test -f node_modules/canvas/build/Release/canvas.node && \
    npm install --no-save drizzle-kit

# ── Stage 2: Build the application ────────────────────────────────
FROM ${BASE_IMAGE} AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY next.config.ts tsconfig.json tsconfig.admin-cli.json ./
COPY postcss.config.mjs components.json drizzle.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY drizzle ./drizzle
COPY config ./config
COPY plugins ./plugins

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build
RUN npm run build:admin-cli

# ── Stage 3: Production runner ────────────────────────────────────
FROM ${BASE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system nodejs && \
    useradd --system --gid nodejs --home-dir /app --shell /usr/sbin/nologin nextjs

# Copy standalone server output (includes traced node_modules with mysql2)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/.admin-cli ./admin-cli

# Copy Drizzle migrations + config so the entrypoint can auto-migrate
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy pre-built drizzle-kit and its deps from the deps stage (native modules already compiled)
COPY --from=deps /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
# drizzle-orm and mysql2 are already in node_modules from standalone trace;
# ensure they exist (standalone may place them in nested paths)
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/mysql2 ./node_modules/mysql2
# pdf-parse depends on @napi-rs/canvas at runtime for DOM geometry polyfills.
# Copy the full namespace so the platform-specific binary package from the Linux
# build stage is available in the production runner.
COPY --from=deps /app/node_modules/@napi-rs ./node_modules/@napi-rs

# Native research skills. Next file tracing excludes this directory, and
# ensureProjectDefaultSkills reads it from the process working directory.
COPY skills ./skills

# Copy entrypoint
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Prepare data directory
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENTRYPOINT ["tini", "--"]
CMD ["/docker-entrypoint.sh"]
