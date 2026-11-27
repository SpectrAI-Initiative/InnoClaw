# Local Docker debug on Windows. Binds the app to 127.0.0.1:3000.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$EnvFile = Join-Path $Root ".env.docker.local"
$SealedFile = Join-Path $Root "config\secrets\docker.local.env"
if (Test-Path $SealedFile) {
  & (Join-Path $PSScriptRoot "ssm-env.ps1") materialize $SealedFile $EnvFile
}

if (-not (Test-Path $SealedFile) -and -not (Test-Path $EnvFile)) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes)
  $text = @"
# 本地 Docker。只改这一个文件。
# 启动：.\scripts\docker-up-local.ps1
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
AUTH_SECRET=$secret
DEEPSEEK_API_KEY=none
DEEPSEEK_BASE_URL=https://tokenhub.tencentmaas.com/v1
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4.1-flash
"@
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($EnvFile, $text.Trim() + "`n", $utf8)
  Write-Host "Created .env.docker.local"
}

$hostPath = "./workspace"
foreach ($line in [System.IO.File]::ReadAllLines($EnvFile)) {
  if ($line -like "HOST_WORKSPACE_PATH=*") {
    $hostPath = $line.Substring("HOST_WORKSPACE_PATH=".Length)
  }
}
if (-not [System.IO.Path]::IsPathRooted($hostPath)) {
  $hostPath = Join-Path $Root $hostPath
}
New-Item -ItemType Directory -Force -Path $hostPath | Out-Null

docker compose --env-file $EnvFile -f docker-compose.yml -f docker-compose.local.yml up -d --build @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "http://127.0.0.1:3000"
