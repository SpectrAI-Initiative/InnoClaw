#!/usr/bin/env bash
# Online Ubuntu VM. Publishes port 3000 on the VM network interface.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

env_file="$root/.env.docker.online"
sealed_file="$root/config/secrets/docker.online.env"

if [[ -f "$sealed_file" ]]; then
  bash "$root/scripts/ssm-env.sh" materialize "$sealed_file" "$env_file"
fi

if [[ ! -f "$sealed_file" && ! -f "$env_file" ]]; then
  secret="$(openssl rand -base64 32 | tr -d '\n')"
  cat > "$env_file" <<EOF
# 线上 Docker。只改这一个文件。
# 启动：./scripts/docker-up-online.sh
# 浏览器：http://<虚拟机IP>:3000
PUBLISH_PORT=3000
HOST_WORKSPACE_PATH=/data/innoscale/research
WORKSPACE_ROOTS=/research
AUTH_MODE=local
AUTH_SINGLE_ADMIN=true
AUTH_COOKIE_SECURE=false
AUTH_SECRET=${secret}
# 必填：腾讯云 MySQL 的内网连接串（同 VPC）。例：mysql://user:password@10.0.0.10:3306/innoscale
DATABASE_URL=
DEEPSEEK_API_KEY=none
DEEPSEEK_BASE_URL=https://tokenhub.tencentmaas.com/v1
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4.1-flash
EOF
  chmod 600 "$env_file"
  echo "Created .env.docker.online — set DATABASE_URL and DEEPSEEK_API_KEY before starting."
fi

host_path="$(awk -F= '$1=="HOST_WORKSPACE_PATH" { value=$2 } END { print value }' "$env_file")"
host_path="${host_path:-/data/innoscale/research}"
mkdir -p "$host_path"

exec docker compose \
  --env-file "$env_file" \
  -f docker-compose.yml \
  -f docker-compose.online.yml \
  up -d --build "$@"
