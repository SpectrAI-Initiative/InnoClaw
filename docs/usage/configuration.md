# Configuration

This page describes how to customize VibeLab's behavior through configuration options.

## Environment-Based Configuration

All configuration is done through environment variables in your `.env.local` file. See [Environment Variables](../getting-started/environment-variables.md) for a complete reference.

## AI Provider Settings

### Selecting a Provider

VibeLab supports multiple AI providers. Configure your preferred provider by setting the appropriate API key:

```ini
# Use OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Use Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx

# Or configure both and switch in the Settings UI
```

### Using Custom Endpoints

For third-party compatible services, proxies, or self-hosted models:

```ini
# Custom OpenAI-compatible endpoint
OPENAI_BASE_URL=https://api.your-provider.com/v1

# Custom Anthropic endpoint
ANTHROPIC_BASE_URL=https://api.your-provider.com
```

### Separate Embedding Configuration

If your chat model provider doesn't support the embedding endpoint, configure a separate service:

```ini
EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_BASE_URL=https://api.your-embedding-provider.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

## In-App Settings

Access the settings page at `/settings` to:

- **Switch AI Provider** — Toggle between OpenAI and Anthropic
- **Select Model** — Choose the specific model to use for chat
- **View API Status** — Check which API keys are configured
- **View Workspace Roots** — See the configured workspace root directories

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

VibeLab uses SQLite with the database stored at `./data/vibelab.db` by default. You can override this path via the `DATABASE_URL` environment variable:

```ini
# Plain filesystem path (no SQLite URI scheme)
DATABASE_URL=/tmp/vibelab/vibelab.db
```

:::{note}
Only plain filesystem paths are accepted (e.g. `/data/vibelab.db`). SQLite connection strings like `file:./data/vibelab.db?mode=rwc` are **not** supported — the `file:` prefix will be stripped automatically.
:::

To use a fresh database:

```bash
# Remove existing database
rm ./data/vibelab.db

# Re-run migrations
npx drizzle-kit migrate
```

## Bot Integration Configuration

See [Notifications](../notifications/index.md) for configuring Feishu and WeChat bot integrations.
