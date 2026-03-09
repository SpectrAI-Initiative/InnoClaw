# Configuration

This page describes how to customize InnoClaw's behavior through configuration options.

## Environment-Based Configuration

All configuration is done through environment variables in your `.env.local` file. See [Environment Variables](../getting-started/environment-variables.md) for a complete reference.

## AI Provider Settings

### Selecting a Provider

InnoClaw supports multiple AI providers. Configure your preferred provider by setting the appropriate API key:

```ini
# Use OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Use Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx

# Use Google Gemini
GEMINI_API_KEY=your-gemini-key

# Or configure multiple and switch in the Settings UI
```

### Default Provider and Model

Set the default LLM provider and model used when the application starts:

```ini
LLM_PROVIDER=openai       # openai, anthropic, or gemini
LLM_MODEL=gpt-4o-mini     # Any model ID from the selected provider
```

These defaults can be overridden at any time via the Settings UI.

### Using Custom Endpoints

For third-party compatible services, proxies, or self-hosted models:

```ini
# Custom OpenAI-compatible endpoint
OPENAI_BASE_URL=https://api.your-provider.com/v1

# Custom Anthropic endpoint
ANTHROPIC_BASE_URL=https://api.your-provider.com

# Custom Gemini-compatible endpoint (OpenAI-compatible proxy)
GEMINI_BASE_URL=https://api.your-provider.com
```

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

- **Switch AI Provider** — Toggle between OpenAI, Anthropic, and Gemini
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

If the project resides on a network filesystem (NFS, CIFS, etc.), the Next.js build cache may fail. Set a local build directory:

```ini
NEXT_BUILD_DIR=/tmp/innoclaw-next
```

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
