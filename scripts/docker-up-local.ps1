# Local entrypoint on Windows.
# Ensures host MySQL is up, then builds/starts the app container.
# Does NOT start the Compose MySQL image.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$EnvFile = Join-Path $Root ".env.docker.local"
$SealedFile = Join-Path $Root "config\secrets\docker.local.env"
$DefaultDbUrl = "mysql://innoscale:innoscale-local@host.docker.internal:3306/innoscale"
$PublishPort = 3000

function Read-EnvMap([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $map[$Matches[1]] = $Matches[2]
    }
  }
  return $map
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  $lines = New-Object System.Collections.Generic.List[string]
  if (Test-Path $Path) {
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) { $lines.Add($line) | Out-Null }
  }
  $found = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match ("^" + [regex]::Escape($Name) + "=")) {
      $lines[$i] = "$Name=$Value"
      $found = $true
      break
    }
  }
  if (-not $found) { $lines.Add("$Name=$Value") | Out-Null }
  [System.IO.File]::WriteAllText($Path, (($lines.ToArray() -join "`n") + "`n"), $utf8)
}

function Test-TcpPort([string]$TargetHost, [int]$Port, [int]$TimeoutMs = 1000) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $ar = $client.BeginConnect($TargetHost, $Port, $null, $null)
    $ok = $ar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if (-not $ok) { $client.Close(); return $false }
    $client.EndConnect($ar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Resolve-LocalMysqld {
  if ($env:LOCAL_MYSQL_HOME) {
    $candidate = Join-Path $env:LOCAL_MYSQL_HOME "bin\mysqld.exe"
    if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
  }
  $runtimeMatches = @(Get-ChildItem -Path (Join-Path $Root ".runtime\mysql") -Filter "mysqld.exe" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\bin\\mysqld\.exe$' } |
    Sort-Object FullName -Descending)
  if ($runtimeMatches.Count -gt 0) { return $runtimeMatches[0].FullName }
  $cmd = Get-Command mysqld.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Ensure-HostMySql {
  if (Test-TcpPort "127.0.0.1" 3306 800) {
    Write-Host "[ok] host MySQL already listening on 127.0.0.1:3306"
    return
  }

  $mysqld = Resolve-LocalMysqld
  if (-not $mysqld) {
    throw @"
Host MySQL is not running on 127.0.0.1:3306, and no local mysqld was found.
Install/start MySQL 8 on the host, or set LOCAL_MYSQL_HOME to the MySQL install root
(example: D:\InnoClaw\.runtime\mysql\mysql-8.0.28-winx64), then re-run this script.
"@
  }

  $basedir = Split-Path (Split-Path $mysqld -Parent) -Parent
  $ini = Join-Path $basedir "my.ini"
  $args = @()
  if (Test-Path $ini) {
    $args = @("--defaults-file=$ini", "--console")
  } else {
    $args = @("--basedir=$basedir", "--datadir=$(Join-Path $basedir 'data')", "--port=3306", "--bind-address=0.0.0.0", "--console")
  }

  Write-Host "[..] starting host MySQL: $mysqld"
  Start-Process -FilePath $mysqld -ArgumentList $args -WindowStyle Hidden | Out-Null

  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpPort "127.0.0.1" 3306 800) {
      Write-Host "[ok] host MySQL is listening on 127.0.0.1:3306"
      return
    }
    Start-Sleep -Seconds 1
  }
  throw "Started mysqld but 127.0.0.1:3306 never became ready."
}

function Ensure-DatabaseUrl {
  $map = Read-EnvMap $EnvFile
  $current = [string]$map["DATABASE_URL"]
  $needsHost =
    [string]::IsNullOrWhiteSpace($current) -or
    ($current -match '@mysql(?::|/|\?)') -or
    ($current -notmatch '^mysql://')

  if ($needsHost) {
    Set-EnvValue $EnvFile "DATABASE_URL" $DefaultDbUrl
    Write-Host "[ok] DATABASE_URL -> host MySQL via host.docker.internal"
  } else {
    Write-Host "[ok] DATABASE_URL kept: $current"
  }
}

function Get-PublishPort {
  $map = Read-EnvMap $EnvFile
  $raw = [string]$map["PUBLISH_PORT"]
  if ($raw -match '^\d+$') { return [int]$raw }
  return 3000
}

function Assert-HttpReady([int]$Port) {
  $url = "http://127.0.0.1:$Port/login"
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        Write-Host "[ok] app ready: $url (HTTP $($resp.StatusCode))"
        return
      }
    } catch {
      Start-Sleep -Seconds 2
      continue
    }
    Start-Sleep -Seconds 2
  }
  throw "App did not become ready at $url"
}

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
AUTH_SINGLE_ADMIN=false
AUTH_COOKIE_SECURE=false
AUTH_SECRET=$secret
DEEPSEEK_API_KEY=none
DEEPSEEK_BASE_URL=https://tokenhub.tencentmaas.com/v1
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4.1-flash
DATABASE_URL=$DefaultDbUrl
"@
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($EnvFile, $text.Trim() + "`n", $utf8)
  Write-Host "Created .env.docker.local"
}

# Materialize overwrites the runtime env file; re-assert host MySQL URL afterwards.
Ensure-DatabaseUrl

$hostPath = "./workspace"
$map = Read-EnvMap $EnvFile
if ($map.ContainsKey("HOST_WORKSPACE_PATH") -and $map["HOST_WORKSPACE_PATH"]) {
  $hostPath = $map["HOST_WORKSPACE_PATH"]
}
if (-not [System.IO.Path]::IsPathRooted($hostPath)) {
  $hostPath = Join-Path $Root $hostPath
}
New-Item -ItemType Directory -Force -Path $hostPath | Out-Null

Write-Host "==> checking dependencies"
Ensure-HostMySql
$PublishPort = Get-PublishPort

# Prefer not leaving a Compose MySQL running for this project.
docker compose --env-file $EnvFile -f docker-compose.yml -f docker-compose.local.yml stop mysql 2>$null | Out-Null

Write-Host "==> building and starting app container (host MySQL)"
docker compose --env-file $EnvFile -f docker-compose.yml -f docker-compose.local.yml up -d --build --no-deps innoscale @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> verifying services"
if (-not (Test-TcpPort "127.0.0.1" 3306 800)) {
  throw "Verification failed: host MySQL is not listening on 127.0.0.1:3306"
}
Write-Host "[ok] host MySQL :3306"
Assert-HttpReady $PublishPort
Write-Host "http://127.0.0.1:$PublishPort"
