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
| `LLM_PROVIDER` | No | Default provider (`openai`, `anthropic`, etc.) |

See [.env.production.example](../.env.production.example) for the full list.

### Volumes

| Container Path | Purpose | Compose Default |
|----------------|---------|-----------------|
| `/app/data` | SQLite database, HF datasets, embeddings | Named volume `innoclaw-data` |
| `/research` | Your workspace files | `HOST_WORKSPACE_PATH` env var or `./workspace` |

To expose multiple workspace directories, add more volume mounts in `docker-compose.yml` and update `WORKSPACE_ROOTS` accordingly:

```yaml
volumes:
  - innoclaw-data:/app/data
  - /home/user/papers:/papers
  - /home/user/code:/code
```
```env
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
server {
    listen 443 ssl;
    server_name innoclaw.example.com;

    ssl_certificate     /etc/ssl/certs/innoclaw.pem;
    ssl_certificate_key /etc/ssl/private/innoclaw.key;

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

**Backup the database:**

```bash
docker compose exec innoclaw cp /app/data/innoclaw.db /app/data/innoclaw.db.bak
# Or copy to host:
docker cp $(docker compose ps -q innoclaw):/app/data/innoclaw.db ./backup.db
```

## Upgrading

```bash
git pull
docker compose build
docker compose up -d
```

Database migrations run automatically on container startup — no manual steps needed.

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
