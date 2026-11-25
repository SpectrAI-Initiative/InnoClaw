#!/usr/bin/env bash
# Publish env secrets to Tencent Cloud SSM, or materialize a runtime env file.
# Usage: ssm-env.sh publish INPUT OUTPUT SECRET_NAME
#        ssm-env.sh materialize SEALED OUTPUT
# Credentials: TENCENTCLOUD_SECRET_ID + TENCENTCLOUD_SECRET_KEY, else ~/Desktop/SecretKey.csv.
set -euo pipefail

command_name="${1:-}"
input_file="${2:-}"
output_file="${3:-}"
secret_name="${4:-}"
region="${SSM_REGION:-ap-shanghai}"
secret_names=" AUTH_SECRET DATABASE_URL DEEPSEEK_API_KEY EMBEDDING_API_KEY GITHUB_TOKEN HF_TOKEN SCP_HUB_API_KEY FEISHU_APP_SECRET FEISHU_VERIFICATION_TOKEN FEISHU_PUSH_SECRET WECHAT_CORP_SECRET WECHAT_TOKEN WECHAT_ENCODING_AES_KEY "

if [[ "$command_name" != "publish" && "$command_name" != "materialize" ]]; then
  echo "usage: $0 publish|materialize INPUT OUTPUT [SECRET_NAME]" >&2
  exit 2
fi
if [[ -z "$input_file" || -z "$output_file" || ! -f "$input_file" ]]; then
  echo "usage: $0 publish|materialize INPUT OUTPUT [SECRET_NAME]" >&2
  exit 2
fi

load_credentials() {
  if [[ -n "${TENCENTCLOUD_SECRET_ID:-}" && -n "${TENCENTCLOUD_SECRET_KEY:-}" ]]; then
    secret_id="$TENCENTCLOUD_SECRET_ID"
    secret_key="$TENCENTCLOUD_SECRET_KEY"
    return
  fi
  local csv="${HOME}/Desktop/SecretKey.csv"
  if [[ ! -f "$csv" ]]; then
    echo "Set TENCENTCLOUD_SECRET_ID and TENCENTCLOUD_SECRET_KEY." >&2
    exit 1
  fi
  secret_id="$(awk -F, 'NR==2 { gsub(/\r/,""); print $1 }' "$csv")"
  secret_key="$(awk -F, 'NR==2 { gsub(/\r/,""); print $2 }' "$csv")"
}

hmac_hex() { printf '%s' "$2" | openssl dgst -sha256 -hmac "$1" | awk '{print $2}'; }
hmac_hexkey() { printf '%s' "$2" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$1" | awk '{print $2}'; }

ssm_call() {
  local action="$1" payload="$2"
  local host="ssm.tencentcloudapi.com"
  local timestamp date hashed canonical hashed_canonical scope string_to_sign
  local date_hex service_hex signing_hex signature authorization response
  timestamp="$(date +%s)"
  date="$(date -u +%Y-%m-%d)"
  hashed="$(printf '%s' "$payload" | openssl dgst -sha256 | awk '{print $2}')"
  canonical="$(printf 'POST\n/\n\ncontent-type:application/json; charset=utf-8\nhost:%s\n\ncontent-type;host\n%s' "$host" "$hashed")"
  hashed_canonical="$(printf '%s' "$canonical" | openssl dgst -sha256 | awk '{print $2}')"
  scope="${date}/ssm/tc3_request"
  string_to_sign="$(printf 'TC3-HMAC-SHA256\n%s\n%s\n%s' "$timestamp" "$scope" "$hashed_canonical")"
  date_hex="$(hmac_hex "TC3${secret_key}" "$date")"
  service_hex="$(hmac_hexkey "$date_hex" "ssm")"
  signing_hex="$(hmac_hexkey "$service_hex" "tc3_request")"
  signature="$(hmac_hexkey "$signing_hex" "$string_to_sign")"
  authorization="TC3-HMAC-SHA256 Credential=${secret_id}/${scope}, SignedHeaders=content-type;host, Signature=${signature}"
  response="$(curl -sS -X POST "https://${host}" \
    -H "Authorization: ${authorization}" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Host: ${host}" \
    -H "X-TC-Action: ${action}" \
    -H "X-TC-Timestamp: ${timestamp}" \
    -H "X-TC-Version: 2019-09-23" \
    -H "X-TC-Region: ${region}" \
    --data "$payload")"
  if printf '%s' "$response" | grep -q '"Error"'; then
    printf '%s\n' "$response" >&2
    return 1
  fi
  printf '%s' "$response"
}

json_field() {
  local json="$1"
  local key="$2"
  local search="${json#*"\"${key}\":\""}"
  local char result="" escaped=0 i
  [[ "$search" != "$json" ]] || return 1
  for ((i = 0; i < ${#search}; i++)); do
    char="${search:$i:1}"
    if [[ $escaped -eq 1 ]]; then
      result+="$char"
      escaped=0
      continue
    fi
    if [[ "$char" == '\' ]]; then
      escaped=1
      continue
    fi
    if [[ "$char" == '"' ]]; then
      printf '%s' "$result"
      return 0
    fi
    result+="$char"
  done
  return 1
}

is_secret_name() { [[ "$secret_names" == *" $1 "* ]]; }
should_publish() {
  local value="$1"
  [[ -n "$value" && "$value" != "none" && "$value" != ssm:* ]] || return 1
  [[ "$value" =~ ^(sk-)?your[-_] || "$value" =~ change-?me || "$value" =~ ^x+$ ]] && return 1
  return 0
}

load_credentials
mkdir -p "$(dirname "$output_file")"

if [[ "$command_name" == "materialize" ]]; then
  version="v1"
  secret_name=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^#\ ssm-region=(.+)$ ]] && region="${BASH_REMATCH[1]}"
    [[ "$line" =~ ^#\ ssm-secret=(.+)$ ]] && secret_name="${BASH_REMATCH[1]}"
    [[ "$line" =~ ^#\ ssm-version=(.+)$ ]] && version="${BASH_REMATCH[1]}"
  done < "$input_file"
  [[ -n "$secret_name" ]] || { echo "Sealed file is missing # ssm-secret." >&2; exit 1; }
  response="$(ssm_call GetSecretValue "{\"SecretName\":\"${secret_name}\",\"VersionId\":\"${version}\"}")" || exit 1
  secret_string="$(json_field "$response" SecretString)"
  opened=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      name="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      if [[ "$value" == ssm:* ]]; then
        key="${value#ssm:}"
        value="$(json_field "$secret_string" "$key")" || { echo "SSM secret has no $key" >&2; exit 1; }
        opened=$((opened + 1))
      fi
      printf '%s=%s\n' "$name" "$value"
    else
      printf '%s\n' "$line"
    fi
  done < "$input_file" > "$output_file"
  chmod 600 "$output_file" || true
  echo "MATERIALIZE_OK opened=$opened file=$output_file"
  exit 0
fi

[[ -n "$secret_name" ]] || { echo "publish requires a secret name." >&2; exit 2; }
json="{"
first=1
published=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
  name="${BASH_REMATCH[1]}"
  value="${BASH_REMATCH[2]}"
  is_secret_name "$name" && should_publish "$value" || continue
  escaped="$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  if [[ $first -eq 0 ]]; then json+=","; fi
  json+="\"${name}\":\"${escaped}\""
  first=0
  published=$((published + 1))
done < "$input_file"
json+="}"
[[ $published -gt 0 ]] || { echo "No secret values to publish." >&2; exit 1; }
version="v1"
payload="$(printf '{"SecretName":"%s","VersionId":"%s","Description":"Innobuddy docker secrets","EncryptType":1,"SecretString":%s}' "$secret_name" "$version" "$(printf '%s' "$json" | sed 's/\\/\\\\/g; s/"/\\"/g')")"
if ! ssm_call CreateSecret "$payload" >/dev/null; then
  version="v$(date +%s)"
  payload="$(printf '{"SecretName":"%s","VersionId":"%s","SecretString":%s}' "$secret_name" "$version" "$(printf '%s' "$json" | sed 's/\\/\\\\/g; s/"/\\"/g')")"
  ssm_call PutSecretValue "$payload" >/dev/null
fi
{
  printf '# ssm-region=%s\n# ssm-secret=%s\n# ssm-version=%s\n' "$region" "$secret_name" "$version"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^#\ ssm-(region|secret|version)= ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      name="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      if is_secret_name "$name" && should_publish "$value"; then
        printf '%s=ssm:%s\n' "$name" "$name"
      else
        printf '%s\n' "$line"
      fi
    else
      printf '%s\n' "$line"
    fi
  done < "$input_file"
} > "$output_file"
echo "PUBLISH_OK secret=$secret_name version=$version published=$published file=$output_file"
