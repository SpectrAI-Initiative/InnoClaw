# Configuration

This page describes how to customize InnoClaw's behavior through configuration options.

## Environment-Based Configuration

All configuration is done through `.env.docker.local` or `.env.docker.online`. See [Environment Variables](../getting-started/environment-variables.md) for the full list.

## AI Provider Settings

### Selecting a Provider

Chat uses Tencent Cloud TokenHub DeepSeek. The Settings UI can switch between the two catalog models:

```ini
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://tokenhub.tencentmaas.com/v1
```

### Default Provider and Model

```ini
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4.1-flash   # or deepseek-v4-pro
```

These defaults can be overridden in the Settings UI. Models outside this catalog are rejected.

### Using a Custom Endpoint

`DEEPSEEK_BASE_URL` already points at TokenHub. Set it only when the OpenAI-compatible endpoint changes. A per-model variable such as `DEEPSEEK_DEEPSEEK_V4_PRO_BASE_URL` overrides it for that model.

### Separate Embedding Configuration

If your chat model provider doesn't support the embedding endpoint, configure a separate service:

```ini
EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_BASE_URL=https://api.your-embedding-provider.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

## Agent Configuration

### Max Tool Steps

Control how many tool-call steps the agent can take per request:

```ini
AGENT_MAX_STEPS=10    # Default: 10, range: 1-100
```

Higher values allow more complex multi-step tasks but consume more tokens.

## In-App Settings

Access the settings page at `/settings` to:

- **Switch model** — Choose DeepSeek V4.1 Flash or DeepSeek V4 Pro
- **Select Model** — Choose the specific model to use for chat
- **View API Status** — Check which API keys are configured
- **View Workspace Roots** — See the configured workspace root directories
- **Configure HuggingFace Token** — Set `HF_TOKEN` for dataset downloads

## Workspace Configuration

### Root Directories

The `WORKSPACE_ROOTS` variable controls which server directories users can create workspaces in:

```ini
# Single root
WORKSPACE_ROOTS=/data/workspaces

# Multiple roots (comma-separated)
WORKSPACE_ROOTS=/data/research,/data/projects,/home/user/documents
```

:::{important}
- All specified directories must already exist on the server
- Users can only create workspaces within these root directories
- Path traversal outside these roots is prevented by security checks
:::

## Database Configuration

InnoClaw uses SQLite with the database stored at `./data/innoclaw.db` by default. You can override this path via the `DATABASE_URL` environment variable:

```ini
# Plain filesystem path (no SQLite URI scheme)
DATABASE_URL=/tmp/innoclaw/innoclaw.db
```

:::{note}
Only plain filesystem paths are accepted (e.g. `/data/innoclaw.db`). SQLite connection strings like `file:./data/innoclaw.db?mode=rwc` are **not** supported — the `file:` prefix will be stripped automatically.
:::

To use a fresh database:

```bash
# Remove existing database
rm ./data/innoclaw.db

# Re-run migrations
npx drizzle-kit migrate
```

## Build Configuration

`NEXT_BUILD_DIR` can point at another build directory inside the repository, for example when the checkout is on a network filesystem:

```ini
NEXT_BUILD_DIR=.next-local
```

`NEXT_BUILD_DIR` must stay within the project root on Next.js 16 / Turbopack. Absolute paths such as `/tmp/innoclaw-next` are not valid here.

## Proxy Configuration

For environments that require an HTTP proxy to reach external APIs:

```ini
HTTP_PROXY=http://your-proxy:3128
HTTPS_PROXY=http://your-proxy:3128
NO_PROXY=localhost,127.0.0.1,10.0.0.0/8
```

All outbound `fetch()` calls (AI API, GitHub, HuggingFace, etc.) will go through the proxy. Hosts listed in `NO_PROXY` bypass it.

## Bot Integration Configuration

See [Notifications](../notifications/index.md) for configuring Feishu and WeChat bot integrations.
