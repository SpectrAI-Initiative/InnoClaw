# Build the reusable InnoScale Docker base image (Ubuntu + Node + build tools).
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$Tag = if ($env:INNOSCALE_BASE_IMAGE) { $env:INNOSCALE_BASE_IMAGE } else { "innoscale-base:24.04-node24.22.3" }
$UbuntuImage = if ($env:UBUNTU_IMAGE) { $env:UBUNTU_IMAGE } else { "docker.1ms.run/library/ubuntu:24.04" }

Write-Host "==> building base image $Tag"
Write-Host "    UBUNTU_IMAGE=$UbuntuImage"

docker build `
  -f Dockerfile.base `
  -t $Tag `
  --build-arg "UBUNTU_IMAGE=$UbuntuImage" `
  --build-arg "NODE_VERSION=24.22.3" `
  --build-arg "NODE_DIST_URL=https://cdn.npmmirror.com/binaries/node" `
  --build-arg "APT_MIRROR=mirrors.aliyun.com" `
  .

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[ok] $Tag"
docker image inspect $Tag --format "{{.Id}} {{.Size}}"
