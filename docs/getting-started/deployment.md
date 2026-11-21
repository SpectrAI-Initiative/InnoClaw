# Deployment

Production is the online Docker stack: `./scripts/docker-up-online.sh` and `.env.docker.online`. The image, volume, and workspace mount are the same ones described in [Docker Operations](../docker.md). This page adds the parts that matter once the VM is reachable from other machines.

There is no supported PM2 or `npm start` deployment.

## Layout

```{mermaid}
graph TB
    subgraph Clients["Clients"]
        Browser["Web Browser"]
        FeishuBot["Feishu Bot"]
        WeChatBot["WeChat Bot"]
    end

    subgraph Host["Ubuntu VM"]
        Proxy["Reverse Proxy<br/>(Nginx / Caddy)"]
        App["InnoClaw container"]
        Data["Volume innoclaw-data<br/>/app/data"]
        Workspace["Host directory<br/>mounted at /research"]
    end

    subgraph External["External Services"]
        DeepSeek["TokenHub DeepSeek"]
        GitHub["GitHub API"]
        HF["HuggingFace Hub"]
    end

    Browser --> Proxy
    FeishuBot --> Proxy
    WeChatBot --> Proxy
    Proxy --> App
    App --> Data
    App --> Workspace
    App --> DeepSeek
    App --> GitHub
    App --> HF
```

The current online compose file publishes plain HTTP on `PUBLISH_PORT` (default 3000). Put Nginx or Caddy in front when you add HTTPS.

## Before the first login

Set these in `.env.docker.online`:

- `DEEPSEEK_API_KEY`
- `HOST_WORKSPACE_PATH` — a directory that exists on the VM
- `WORKSPACE_ROOTS=/research`
- `AUTH_SECRET` — a long random value
- `AUTH_COOKIE_SECURE=false` while the site is plain HTTP. Set it to `true` after HTTPS is in front
- `AUTH_MODE=local` unless the VM is reachable only by people you trust. `disabled` gives every caller administrator access

`AUTH_SINGLE_ADMIN=true` keeps public registration from creating another administrator. Bootstrap that account once:

```bash
umask 077
openssl rand -base64 32 > /tmp/innoclaw-admin-password
docker compose --env-file .env.docker.online -f docker-compose.yml -f docker-compose.online.yml exec -T innoclaw \
  node /app/admin-cli/scripts/bootstrap-admin.js \
  --email admin@example.com --name Administrator \
  < /tmp/innoclaw-admin-password
```

Send the password through a channel you control, then delete the temporary file. Ordinary registration creates normal users. Each user gets a private workspace root under `<configured-root>/users/<user-id>`.

## Reverse proxy

Point the proxy at `127.0.0.1:3000`, or at the published port if the proxy is not on the same VM. Forward `Upgrade` so streaming responses stay open. After the certificate is in place, set `AUTH_COOKIE_SECURE=true` and start the stack again.

### Nginx

```nginx
limit_req_zone $binary_remote_addr zone=innoclaw_login:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=innoclaw_register:10m rate=1r/m;

server {
    listen 80;
    server_name your-domain.com;

    location = /api/auth/login {
        limit_req zone=innoclaw_login burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/auth/register {
        limit_req zone=innoclaw_register burst=2 nodelay;
        limit_req_status 429;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```
your-domain.com {
    reverse_proxy 127.0.0.1:3000
}
```

## Backup before an upgrade

Use the backup command in [Docker Operations](../docker.md). Keep the previous image until login, a normal user's workspace, and one model reply have been checked. The migration preflight stops if two workspace rows would collide. It does not delete or reassign a workspace.
