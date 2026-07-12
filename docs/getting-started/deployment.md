# Deployment

This guide covers deploying InnoClaw in production environments.

## Deployment Architecture

```{mermaid}
graph TB
    subgraph Clients["Clients"]
        Browser["Web Browser"]
        FeishuBot["Feishu Bot"]
        WeChatBot["WeChat Bot"]
    end

    subgraph Host["Production Server"]
        Proxy["Reverse Proxy<br/>(Nginx / Caddy)"]
        App["InnoClaw<br/>(Next.js)"]
        SQLite["SQLite DB<br/>./data/innoclaw.db"]
        Workspace["Workspace Files<br/>WORKSPACE_ROOTS"]
    end

    subgraph External["External Services"]
        OpenAI["OpenAI API"]
        Anthropic["Anthropic API"]
        Gemini["Gemini API"]
        GitHub["GitHub API"]
        HF["HuggingFace Hub"]
    end

    Browser --> Proxy
    FeishuBot --> Proxy
    WeChatBot --> Proxy
    Proxy --> App
    App --> SQLite
    App --> Workspace
    App --> OpenAI
    App --> Anthropic
    App --> Gemini
    App --> GitHub
    App --> HF
```

## Option 1: Direct Deployment (Recommended for Self-Hosting)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your settings

# 3. Initialize the database
npx drizzle-kit migrate

# 4. Build the production version
npm run build

# 5. Start the production server (default port 3000)
npm run start

# Or start without application-level registration/login
npm run start:no-auth

# Or specify a custom port
PORT=8080 npm run start
```

`npm run start:no-auth` sets `AUTH_MODE=disabled`. Anyone who can reach the service gets admin-level access, so use it only behind trusted network access or another access-control layer.

## Option 2: PM2 Process Manager

[PM2](https://pm2.keymetrics.io/) keeps your application running in the background and auto-restarts on crashes.

```bash
# Install PM2 globally
npm install -g pm2

# Build and start
npm run build
pm2 start npm --name "innoclaw" -- start

# Or start without application-level registration/login
pm2 start npm --name "innoclaw-no-auth" -- run start:no-auth

# Check status
pm2 status

# View logs
pm2 logs innoclaw

# Enable auto-start on boot
pm2 startup
pm2 save
```

## Option 3: Docker Deployment

### Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:24-alpine

# Install git (required for GitHub integration)
RUN apk add --no-cache git python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["sh", "-c", "npx drizzle-kit migrate && npm run start"]
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  innoclaw:
    build: .
    ports:
      - "3000:3000"
    volumes:
      # Persist database
      - ./data:/app/data
      # Mount workspace directories
      - /data/research:/data/research
      - /data/projects:/data/projects
    environment:
      - WORKSPACE_ROOTS=/data/research,/data/projects
      - AUTH_MODE=local
      - AUTH_SINGLE_ADMIN=true
      - AUTH_COOKIE_SECURE=true
      - AUTH_SECRET=replace-with-a-long-random-secret
      - OPENAI_API_KEY=sk-xxx
      - ANTHROPIC_API_KEY=sk-ant-xxx
      - GEMINI_API_KEY=your-gemini-key
      - GITHUB_TOKEN=ghp_xxx
      - LLM_PROVIDER=openai
      - LLM_MODEL=gpt-4o-mini
      # OpenAI only: none|minimal|low|medium|high|xhigh; ultra maps to xhigh.
      # - OPENAI_REASONING_EFFORT=high
      - AGENT_MAX_STEPS=10
      # - HTTP_PROXY=http://your-proxy:3128
      # - HTTPS_PROXY=http://your-proxy:3128
    restart: unless-stopped
```

Start the container:

```bash
docker-compose up -d
```

### Single-Administrator Rollout

With `AUTH_SINGLE_ADMIN=true`, application startup remains fail-closed for public
registration until the sole administrator has been bootstrapped. For the
repository Docker image, generate a password and pass it only through standard
input:

```bash
umask 077
openssl rand -base64 32 > /tmp/innoclaw-admin-password
docker compose exec -T innoclaw node /app/admin-cli/scripts/bootstrap-admin.js \
  --email admin@example.com --name Administrator \
  < /tmp/innoclaw-admin-password
```

Deliver the password through a secure channel, then remove the temporary file.
Public registration creates ordinary users only. Each user receives private
workspace roots below `<configured-root>/users/<immutable-user-id>`; only the
administrator can list and manage all workspace records.

Before upgrading an existing installation, create an online SQLite backup and
back up the environment and reverse-proxy configuration. The migration
preflight canonicalizes existing workspace paths and stops if two rows collide;
it never deletes or silently reassigns a workspace.

If the first rollout must use plain HTTP, explicitly set
`AUTH_COOKIE_SECURE=false`. This only makes the cookie usable over HTTP and does
not protect credentials or session traffic. Keep any existing outer access gate
until administrator login, ordinary-user registration, two-user workspace
isolation, and model inference have passed. Then move to HTTPS and restore
`AUTH_COOKIE_SECURE=true`.

## Reverse Proxy Configuration

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
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/auth/register {
        limit_req zone=innoclaw_register burst=2 nodelay;
        limit_req_status 429;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
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
    reverse_proxy localhost:3000
}
```

## Data Backup

| Data | Location | Description |
|------|----------|-------------|
| SQLite Database | `./data/innoclaw.db` | Workspaces, source index, chat history, notes, settings |
| Workspace Files | `WORKSPACE_ROOTS` directories | User's actual files (outside the project directory) |
| Configuration | `.env.local` | Environment variables and API keys |

To back up, save the `./data/` directory and `.env.local` file.

Do not copy a live SQLite database file directly while it may be using WAL.
Use SQLite's online backup API (the Docker guide includes a command), verify the
backup with `PRAGMA integrity_check`, and retain the previous application image
until the post-deployment checks pass.
