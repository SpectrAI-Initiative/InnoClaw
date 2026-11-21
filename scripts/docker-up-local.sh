#!/usr/bin/env bash
# Local Docker debug on Ubuntu 24.04. Binds the app to 127.0.0.1:3000.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

env_file="$root/.env.docker.local"

if [[ ! -f "$env_file" ]]; then
  secret="$(openssl rand -base64 32 | tr -d '\n')"
  cat > "$env_file" <<EOF
# 本地 Docker。只改这一个文件。
# 启动：./scripts/docker-up-local.sh
# 浏览器：http://127.0.0.1:3000
HOST_WORKSPACE_PATH=./workspace
WORKSPACE_ROOTS=/research
AUTH_MODE=local
AUTH_SINGLE_ADMIN=false
AUTH_COOKIE_SECURE=false
AUTH_SECRET=${secret}
DEEPSEEK_API_KEY=none
DEEPSEEK_BASE_URL=https://tokenhub.tencentmaas.com/v1
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4.1-flash
EOF
  chmod 600 "$env_file"
  echo "Created .env.docker.local"
fi

host_path="$(awk -F= '$1=="HOST_WORKSPACE_PATH" { value=$2 } END { print value }' "$env_file")"
host_path="${host_path:-./workspace}"
mkdir -p "$host_path"

exec docker compose \
  --env-file "$env_file" \
  -f docker-compose.yml \
  -f docker-compose.local.yml \
  up -d --build "$@"
