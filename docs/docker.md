# Docker Operations

InnoClaw runs only through Docker. Start and stop commands are in [Installation](getting-started/installation.md). This page covers the data that survives a rebuild, upgrades, and the failures that show up after the container is up.

The image is Ubuntu Server 24.04 LTS amd64. Local and online use the same image and different env files.

| Environment | Env file | Compose files |
|-------------|----------|----------------|
| Local | `.env.docker.local` | `docker-compose.yml` + `docker-compose.local.yml` |
| Online VM | `.env.docker.online` | `docker-compose.yml` + `docker-compose.online.yml` |

## What is persisted

| Data | Where |
|------|--------|
| SQLite database, Hugging Face dataset cache | Docker volume `innoclaw-data`, mounted at `/app/data` |
| Workspace files | Host directory `HOST_WORKSPACE_PATH`, mounted at `/research` |
| Settings | The env file for that environment |

`WORKSPACE_ROOTS` is a path inside the container. For the default mount it is `/research`.

## Backup

Do not copy a live SQLite file while it may be using WAL. From the repository root, for the local stack:

```bash
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose.local.yml exec -T innoclaw node -e \
  'const Database=require("better-sqlite3");const db=new Database("/app/data/innoclaw.db");db.backup("/app/data/innoclaw.db.backup").then(()=>db.close())'
```

On the online VM, use `--env-file .env.docker.online` and `-f docker-compose.online.yml`.

Also keep a copy of the env file and the host workspace directory. Check the backup with `PRAGMA integrity_check` before deleting the previous one.

## Upgrade

```bash
git pull
./scripts/docker-up-local.sh
```

On the online VM, run `./scripts/docker-up-online.sh` instead. Migrations run when the container starts.

## Logs and stop

```bash
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose.local.yml logs -f innoclaw
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose.local.yml down
```

Replace the env file and the second compose file for the online VM.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `workspace root missing` | `HOST_WORKSPACE_PATH` must exist on the host. `WORKSPACE_ROOTS` must be the container path, usually `/research` |
| `no AI API key detected` | Set `DEEPSEEK_API_KEY` in the env file that this stack loads, then run the start script again |
| Container exits immediately | Read `docker compose logs innoclaw` |
| Port already in use | Local binds `127.0.0.1:3000`. Online uses `PUBLISH_PORT` |
