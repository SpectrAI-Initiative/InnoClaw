#!/usr/bin/env bash
# Local entrypoint on Ubuntu.
# Ensures host MySQL is up, then builds/starts the app container.
# Does NOT start the Compose MySQL image.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
# Keep container/image names on product brand, not the host folder name.
export COMPOSE_PROJECT_NAME=innoscale

env_file="$root/.env.docker.local"
sealed_file="$root/config/secrets/docker.local.env"
default_db_url='mysql://innoscale:innoscale-local@host.docker.internal:3306/innoscale'

read_env_value() {
  local key="$1"
  awk -F= -v k="$key" '$1==k { print substr($0, index($0,"=")+1); found=1 } END { if (!found) exit 0 }' "$env_file" 2>/dev/null || true
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$env_file" ]] && grep -qE "^${key}=" "$env_file"; then
    awk -F= -v k="$key" -v v="$value" '
      $1==k { print k "=" v; next }
      { print }
    ' "$env_file" >"$tmp"
  else
    if [[ -f "$env_file" ]]; then
      cat "$env_file" >"$tmp"
    else
      : >"$tmp"
    fi
    printf '%s=%s\n' "$key" "$value" >>"$tmp"
  fi
  mv "$tmp" "$env_file"
  chmod 600 "$env_file" 2>/dev/null || true
}

tcp_ready() {
  local host="$1"
  local port="$2"
  if command -v nc >/dev/null 2>&1; then
    nc -z "$host" "$port" >/dev/null 2>&1
    return $?
  fi
  (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1
}

ensure_database_url() {
  local current
  current="$(read_env_value DATABASE_URL || true)"
  if [[ -z "${current}" || "${current}" != mysql://* || "${current}" =~ @mysql(:|/|\?) ]]; then
    set_env_value DATABASE_URL "$default_db_url"
    echo "[ok] DATABASE_URL -> host MySQL via host.docker.internal"
    return
  fi
  echo "[ok] DATABASE_URL kept: $current"
}

ensure_host_mysql() {
  if tcp_ready 127.0.0.1 3306; then
    echo "[ok] host MySQL already listening on 127.0.0.1:3306"
    return
  fi

  echo "[..] host MySQL not listening; trying to start local service"
  if command -v systemctl >/dev/null 2>&1; then
    for unit in mysql mysqld mariadb; do
      if systemctl list-unit-files "$unit.service" >/dev/null 2>&1; then
        sudo systemctl start "$unit" || true
        break
      fi
    done
  fi

  local i
  for i in $(seq 1 45); do
    if tcp_ready 127.0.0.1 3306; then
      echo "[ok] host MySQL is listening on 127.0.0.1:3306"
      return
    fi
    sleep 1
  done

  cat <<EOF >&2
Host MySQL is not running on 127.0.0.1:3306.
Install/start MySQL 8 on the host, then re-run ./scripts/docker-up-local.sh.
EOF
  exit 1
}

assert_http_ready() {
  local port="$1"
  local url="http://127.0.0.1:${port}/login"
  local i
  for i in $(seq 1 45); do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS -o /dev/null "$url"; then
        echo "[ok] app ready: $url"
        return
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q -O /dev/null "$url"; then
        echo "[ok] app ready: $url"
        return
      fi
    else
      if tcp_ready 127.0.0.1 "$port"; then
        echo "[ok] app port open: 127.0.0.1:${port}"
        return
      fi
    fi
    sleep 2
  done
  echo "App did not become ready at $url" >&2
  exit 1
}

if [[ -f "$sealed_file" ]]; then
  bash "$root/scripts/ssm-env.sh" materialize "$sealed_file" "$env_file"
fi

if [[ ! -f "$sealed_file" && ! -f "$env_file" ]]; then
  secret="$(openssl rand -base64 32 | tr -d '\n')"
  cat > "$env_file" <<EOF
# 本地 Docker。只改这一个文件。
# 启动：./scripts/docker-up-local.sh
# 浏览器：http://127.0.0.1:3000
PUBLISH_PORT=3000
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
DATABASE_URL=${default_db_url}
EOF
  chmod 600 "$env_file"
  echo "Created .env.docker.local"
fi

# Materialize overwrites the runtime env file; re-assert host MySQL URL afterwards.
ensure_database_url

host_path="$(read_env_value HOST_WORKSPACE_PATH || true)"
host_path="${host_path:-./workspace}"
mkdir -p "$host_path"

echo "==> checking dependencies"
ensure_host_mysql
publish_port="$(read_env_value PUBLISH_PORT || true)"
publish_port="${publish_port:-3000}"

docker compose --env-file "$env_file" -f docker-compose.yml -f docker-compose.local.yml stop mysql >/dev/null 2>&1 || true

base_image="${BASE_IMAGE:-${INNOSCALE_BASE_IMAGE:-innoscale-base:24.04-node24.22.3}}"
export BASE_IMAGE="$base_image"
if ! docker image inspect "$base_image" >/dev/null 2>&1; then
  echo "==> base image missing, building $base_image"
  bash "$root/scripts/docker-build-base.sh"
fi

echo "==> building and starting app container (host MySQL)"
docker compose \
  --env-file "$env_file" \
  -f docker-compose.yml \
  -f docker-compose.local.yml \
  up -d --build --no-deps innoscale "$@"

echo "==> verifying services"
if ! tcp_ready 127.0.0.1 3306; then
  echo "Verification failed: host MySQL is not listening on 127.0.0.1:3306" >&2
  exit 1
fi
echo "[ok] host MySQL :3306"
assert_http_ready "$publish_port"
echo "http://127.0.0.1:${publish_port}"
