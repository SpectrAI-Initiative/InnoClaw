#!/usr/bin/env bash
# Build the reusable InnoScale Docker base image (Ubuntu + Node + build tools).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

tag="${INNOSCALE_BASE_IMAGE:-innoscale-base:24.04-node24.22.3}"
ubuntu_image="${UBUNTU_IMAGE:-docker.1ms.run/library/ubuntu:24.04}"

echo "==> building base image $tag"
echo "    UBUNTU_IMAGE=$ubuntu_image"

docker build \
  -f Dockerfile.base \
  -t "$tag" \
  --build-arg "UBUNTU_IMAGE=$ubuntu_image" \
  --build-arg "NODE_VERSION=24.22.3" \
  --build-arg "NODE_DIST_URL=https://cdn.npmmirror.com/binaries/node" \
  --build-arg "APT_MIRROR=mirrors.aliyun.com" \
  .

echo "[ok] $tag"
docker image inspect "$tag" --format '{{.Id}} {{.Size}}'
