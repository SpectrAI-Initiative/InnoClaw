# Installation

InnoClaw starts only through Docker on Ubuntu Server 24.04 LTS amd64.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Docker Engine 24+ | With Compose v2 |
| Git | Clone the repository |
| DeepSeek API key | Tencent Cloud TokenHub, required for chat |

## Local setup

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
```

Windows:

```powershell
.\scripts\docker-up-local.ps1
```

Ubuntu:

```bash
chmod +x scripts/docker-up-local.sh
./scripts/docker-up-local.sh
```

Open **http://127.0.0.1:3000**.

Edit only `.env.docker.local`. The script creates it on first run.

## Online setup

On the Ubuntu VM:

```bash
chmod +x scripts/docker-up-online.sh
./scripts/docker-up-online.sh
```

Open `http://<vm-ip>:3000`.

Edit only `.env.docker.online`.

## Env files

| File | Used by |
|------|---------|
| `.env.docker.local` | Local Docker |
| `.env.docker.online` | Online Docker |

There are no other startup env files. Both stay untracked.

## Verify

1. Workspace list opens
2. You can create a workspace under `/research`
3. With `DEEPSEEK_API_KEY` set, chat works after Sync
