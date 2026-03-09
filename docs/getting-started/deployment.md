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

# Or specify a custom port
PORT=8080 npm run start
```

## Option 2: PM2 Process Manager

[PM2](https://pm2.keymetrics.io/) keeps your application running in the background and auto-restarts on crashes.

```bash
# Install PM2 globally
npm install -g pm2

# Build and start
npm run build
pm2 start npm --name "innoclaw" -- start

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
FROM node:20-alpine

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
      - OPENAI_API_KEY=sk-xxx
      - ANTHROPIC_API_KEY=sk-ant-xxx
      - GEMINI_API_KEY=your-gemini-key
      - GITHUB_TOKEN=ghp_xxx
      - LLM_PROVIDER=openai
      - LLM_MODEL=gpt-4o-mini
      - AGENT_MAX_STEPS=10
      # - HTTP_PROXY=http://your-proxy:3128
      # - HTTPS_PROXY=http://your-proxy:3128
    restart: unless-stopped
```

Start the container:

```bash
docker-compose up -d
```

## Reverse Proxy Configuration

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
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
