#!/usr/bin/env bash
# Local Docker debug on Linux and macOS. Binds the app to 127.0.0.1:3000.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

env_file="$root/.env.docker.local"
sealed_file="$root/config/secrets/docker.local.env"

if [[ "${INNOBUDDY_LOCAL_ENV_ONLY:-false}" == "true" && ! -f "$env_file" ]]; then
  echo "Local env file is required when INNOBUDDY_LOCAL_ENV_ONLY=true." >&2
  exit 1
fi

if [[ -f "$sealed_file" && "${INNOBUDDY_LOCAL_ENV_ONLY:-false}" != "true" ]]; then
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
# Optional OneID application configuration (not Tencent Cloud account API keys).
AUTH_OIDC_PROVIDER=oidc
AUTH_OIDC_ENABLED=false
AUTH_OIDC_ISSUER=
AUTH_OIDC_CLIENT_ID=
AUTH_OIDC_CLIENT_SECRET=
AUTH_OIDC_REDIRECT_URI=
AUTH_OIDC_ALLOW_HTTP=false
# Leave the four URLs empty to use OIDC discovery. Tencent OneID has no discovery
# document, so fill in authorize, token and jwks (userinfo if email is not a token claim).
AUTH_OIDC_AUTHORIZE_URL=
AUTH_OIDC_TOKEN_URL=
AUTH_OIDC_JWKS_URL=
AUTH_OIDC_USERINFO_URL=
AUTH_OIDC_SCOPE=
AUTH_OIDC_REQUIRE_NONCE=true
AUTH_OIDC_REQUIRE_EMAIL_VERIFIED=true
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

compose_files=(-f docker-compose.yml -f docker-compose.local.yml)
if [[ "${INNOBUDDY_LOCAL_HTTPS:-false}" == "true" ]]; then
  if [[ ! -s "$root/deploy/tls-local/fullchain.pem" ]]; then
    echo "Run 'bash scripts/local-tls.sh' before INNOBUDDY_LOCAL_HTTPS=true." >&2
    exit 1
  fi
  compose_files+=(-f docker-compose.https.local.yml)
  echo "Local HTTPS enabled: https://localhost:8443"
fi

exec docker compose \
  --env-file "$env_file" \
  "${compose_files[@]}" \
  up -d --build "$@"
