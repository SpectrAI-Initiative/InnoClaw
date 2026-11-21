# Local Docker debug on Windows. Binds the app to 127.0.0.1:3000.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$EnvFile = Join-Path $Root ".env.docker.local"

if (-not (Test-Path $EnvFile)) {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes)
  $text = @"
# 本地 Docker。只改这一个文件。
# 启动：.\scripts\docker-up-local.ps1
# 浏览器：http://127.0.0.1:3000
HOST_WORKSPACE_PATH=./workspace
WORKSPACE_ROOTS=/research
AUTH_MODE=local
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
