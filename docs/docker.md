# Docker Deployment

Deploy InnoClaw with Docker in under 2 minutes.

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- At least one AI API key (OpenAI, Anthropic, etc.)

## Quick Start

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
cp .env.production.example .env.production.local
# Edit .env.production.local — set at least one API key
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

### Environment Variables

Edit `.env.production.local` before starting. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKSPACE_ROOTS` | Yes | Comma-separated paths **inside the container** (e.g., `/research`) |
| `OPENAI_API_KEY` | At least one AI key | OpenAI API key |
| `ANTHROPIC_API_KEY` | | Anthropic API key |
| `DATABASE_URL` | No | SQLite path (default: `./data/innoclaw.db`) |
| `AUTH_MODE` | No | Set to `disabled` only for trusted deployments that should bypass registration/login |
| `AUTH_SINGLE_ADMIN` | No | Set to `true` to enforce one bootstrapped administrator and ordinary-user registration |
| `AUTH_COOKIE_SECURE` | No | Defaults to `true` in production; use `false` only for a temporary plain-HTTP rollout |
| `AUTH_SECRET` | Production | Long random value used to sign session cookies |
| `LLM_PROVIDER` | No | Default provider (`openai`, `anthropic`, etc.) |
| `OPENAI_REASONING_EFFORT` | No | OpenAI reasoning effort; `ultra` is normalized to `xhigh` |

See [.env.production.example](../.env.production.example) for the full list.

To run without application-level registration or login, set `AUTH_MODE=disabled` in `.env.production.local` before starting the container. Anyone who can reach the service gets admin-level access, so use it only behind trusted network access or another access-control layer.

### Bootstrap a Single Administrator

For a public multi-user deployment, configure at least:

```ini
AUTH_MODE=local
AUTH_SINGLE_ADMIN=true
AUTH_COOKIE_SECURE=true
AUTH_SECRET=replace-with-a-long-random-secret
WORKSPACE_ROOTS=/research
```

Start the container so migrations complete, then create the sole administrator
with a password supplied only through standard input:

```bash
umask 077
openssl rand -base64 32 > /tmp/innoclaw-admin-password
docker compose exec -T innoclaw node /app/admin-cli/scripts/bootstrap-admin.js \
  --email admin@example.com --name Administrator \
  < /tmp/innoclaw-admin-password
```

Store the generated password in your password manager and securely remove the
temporary file after delivery. Re-running the same command is idempotent and
does not rotate an existing administrator password. Bootstrap must finish before
public registration becomes available. Registered users are always ordinary
users and cannot promote themselves or another account.

For a temporary plain-HTTP rollout, set `AUTH_COOKIE_SECURE=false` so browsers
can send the session cookie. This does **not** encrypt credentials or traffic.
Move to HTTPS and restore `AUTH_COOKIE_SECURE=true` as soon as possible.

### OpenAI-Compatible Reasoning

`OPENAI_REASONING_EFFORT` accepts `none`, `minimal`, `low`, `medium`, `high`,
and `xhigh`. The operator-friendly value `ultra` is normalized to `xhigh`
before OpenAI language-model calls. Omit the variable to retain the provider
default. The setting does not affect embeddings or non-OpenAI providers; verify
that a custom OpenAI-compatible endpoint supports the normalized value.

### Volumes

| Container Path | Purpose | Compose Default |
|----------------|---------|-----------------|
| `/app/data` | SQLite database, HF datasets, embeddings | Named volume `innoclaw-data` |
| `/research` | Your workspace files | `HOST_WORKSPACE_PATH` env var or `./workspace` |

In single-administrator mode, an ordinary user's effective root is provisioned
lazily at `/research/users/<immutable-user-id>` with private permissions. Users
can create and operate only their own workspaces. The administrator can view and
manage workspace records across the full `/research` operator root.

To expose multiple workspace directories, add more volume mounts in `docker-compose.yml` and update `WORKSPACE_ROOTS` accordingly:

```yaml
volumes:
  - innoclaw-data:/app/data
  - /home/user/papers:/papers
  - /home/user/code:/code
```
```ini
WORKSPACE_ROOTS=/papers,/code
```

### Port

Default: `3000`. Change in `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"
```

## Reverse Proxy

InnoClaw works behind any reverse proxy. Examples:

### Nginx

```nginx
limit_req_zone $binary_remote_addr zone=innoclaw_login:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=innoclaw_register:10m rate=1r/m;

server {
    listen 443 ssl;
    server_name innoclaw.example.com;

    ssl_certificate     /etc/ssl/certs/innoclaw.pem;
    ssl_certificate_key /etc/ssl/private/innoclaw.key;

    location = /api/auth/login {
        limit_req zone=innoclaw_login burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/auth/register {
        limit_req zone=innoclaw_register burst=2 nodelay;
        limit_req_status 429;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```
innoclaw.example.com {
    reverse_proxy localhost:3000
}
```

Caddy handles TLS automatically.

## Persistent Data & Backups

All persistent state lives in the `innoclaw-data` volume:

- `innoclaw.db` — SQLite database (notebooks, chat history, settings)
- `hf-datasets/` — cached HuggingFace datasets

**Back up the database while the service is running:**

```bash
docker compose exec -T innoclaw node -e \
  'const Database=require("better-sqlite3");const db=new Database("/app/data/innoclaw.db");db.backup("/app/data/innoclaw.db.backup").then(()=>db.close())'
docker cp "$(docker compose ps -q innoclaw):/app/data/innoclaw.db.backup" ./backup.db
```

The online backup API includes committed WAL state. Also back up the root-readable
environment file and reverse-proxy configuration, and retain the previous image
until login, workspace isolation, and model inference smoke tests pass.

## Upgrading

```bash
git pull
docker compose build
docker compose up -d
```

Database migrations run automatically on container startup — no manual steps needed.
The canonical workspace-path preflight runs before the unique path index. If two
legacy rows resolve to the same filesystem path, startup stops and reports the
colliding workspace IDs instead of deleting or reassigning data.

## Build from Scratch

```bash
docker build -t innoclaw .
docker run -d \
  --name innoclaw \
  -p 3000:3000 \
  --env-file .env.production.local \
  -v innoclaw-data:/app/data \
  -v /path/to/your/research:/research \
  innoclaw
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `/app/data is not writable` | Ensure the Docker volume is mounted and the container user has write access |
| `workspace root missing` | Mount your host directory in `docker-compose.yml` and match `WORKSPACE_ROOTS` |
| `no AI API key detected` | Edit `.env.production.local` and set at least one valid API key |
| `drizzle-kit migrate failed` | Usually harmless on first run; check that `/app/data` is writable |
| Container exits immediately | Run `docker compose logs innoclaw` to see the startup error |
