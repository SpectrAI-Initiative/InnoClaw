# Ubuntu Server 24.04 LTS (Noble) amd64.
# Default pull goes through a domestic Docker Hub mirror; override UBUNTU_IMAGE if needed.
ARG UBUNTU_IMAGE=docker.m.daocloud.io/library/ubuntu:24.04
ARG NODE_VERSION=24.22.3
ARG NODE_DIST_URL=https://cdn.npmmirror.com/binaries/node
ARG APT_MIRROR=mirrors.aliyun.com
ARG NPM_REGISTRY=https://registry.npmmirror.com

FROM ${UBUNTU_IMAGE} AS nodebase

ARG NODE_VERSION
ARG NODE_DIST_URL
ARG APT_MIRROR

ENV DEBIAN_FRONTEND=noninteractive

# Ubuntu Server 24.04 uses deb822 sources. The base image has no CA store yet,
# so the first apt update must stay on plain HTTP. Domestic mirrors are used
# before ca-certificates is installed.
RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/ubuntu.sources ]; then \
      sed -i \
        -e "s|http://archive.ubuntu.com/ubuntu|http://${APT_MIRROR}/ubuntu|g" \
        -e "s|http://security.ubuntu.com/ubuntu|http://${APT_MIRROR}/ubuntu|g" \
        -e "s|https://archive.ubuntu.com/ubuntu|http://${APT_MIRROR}/ubuntu|g" \
        -e "s|https://security.ubuntu.com/ubuntu|http://${APT_MIRROR}/ubuntu|g" \
        /etc/apt/sources.list.d/ubuntu.sources; \
    fi; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl xz-utils; \
    curl -fsSL "${NODE_DIST_URL}/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz; \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1; \
    rm -f /tmp/node.tar.xz; \
    node --version; \
    npm --version; \
    rm -rf /var/lib/apt/lists/*

# ── Stage 1: Install dependencies ──────────────────────────────────
FROM nodebase AS deps

ARG NPM_REGISTRY
ARG APT_MIRROR

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry "${NPM_REGISTRY}" && \
    npm ci && \
    npm install --no-save drizzle-kit

# ── Stage 2: Build the application ────────────────────────────────
FROM nodebase AS builder

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
FROM nodebase AS runner

RUN apt-get update && \
    apt-get install -y --no-install-recommends tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system nodejs && \
    useradd --system --gid nodejs --home-dir /app --shell /usr/sbin/nologin nextjs

# Copy standalone server output (includes traced node_modules with better-sqlite3)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/.admin-cli ./admin-cli

# Copy Drizzle migrations + config so the entrypoint can auto-migrate
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# Copy pre-built drizzle-kit and its deps from the deps stage (native modules already compiled)
COPY --from=deps /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
# drizzle-orm and better-sqlite3 are already in node_modules from standalone trace;
# ensure they exist (standalone may place them in nested paths)
COPY --from=deps /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
# pdf-parse depends on @napi-rs/canvas at runtime for DOM geometry polyfills.
# Copy the full namespace so the platform-specific binary package from the Linux
# build stage is available in the production runner.
COPY --from=deps /app/node_modules/@napi-rs ./node_modules/@napi-rs

# Copy entrypoint
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Prepare data directory
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENTRYPOINT ["tini", "--"]
CMD ["/docker-entrypoint.sh"]
