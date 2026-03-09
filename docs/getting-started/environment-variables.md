# Environment Variables

A complete reference of all environment variables used by VibeLab.

## Core Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `WORKSPACE_ROOTS` | `string` | **Yes** | — | Comma-separated absolute paths where workspaces can be created. Directories must exist on the server. |

## AI Provider Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `OPENAI_API_KEY` | `string` | No | — | OpenAI API key for chat and embedding. |
| `ANTHROPIC_API_KEY` | `string` | No | — | Anthropic API key for Claude models. |
| `OPENAI_BASE_URL` | `string` | No | `https://api.openai.com/v1` | Custom OpenAI-compatible API endpoint (for proxies or third-party providers). |
| `ANTHROPIC_BASE_URL` | `string` | No | `https://api.anthropic.com` | Custom Anthropic API endpoint. |

:::{note}
At least one AI API key (OpenAI or Anthropic) is needed for AI chat and note generation features. Without any API key, workspace management, file browsing, and other non-AI features still work.
:::

## Embedding API Configuration

These allow using a separate service for vector embeddings, independent of the chat model provider.

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `EMBEDDING_API_KEY` | `string` | No | Falls back to `OPENAI_API_KEY` | API key for the embedding service. |
| `EMBEDDING_BASE_URL` | `string` | No | Falls back to `OPENAI_BASE_URL` | Endpoint for the embedding service. |
| `EMBEDDING_MODEL` | `string` | No | `text-embedding-3-small` | Name of the embedding model to use. |

**Example** — Using a dedicated embedding service:

```ini
# Chat model (via OpenAI-compatible proxy)
OPENAI_API_KEY=sk-your-chat-key
OPENAI_BASE_URL=http://your-proxy:3888/v1

# Embedding model (separate configuration)
EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_BASE_URL=http://your-proxy:3888/v1
EMBEDDING_MODEL=google/gemini-embedding-001
```

## GitHub Integration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `GITHUB_TOKEN` | `string` | No | — | GitHub Personal Access Token for cloning/pulling private repositories. Requires `repo` scope. |

## Feishu (Lark) Bot Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `FEISHU_BOT_ENABLED` | `boolean` | No | `false` | Enable Feishu bot integration. |
| `FEISHU_APP_ID` | `string` | No | — | Feishu application ID. |
| `FEISHU_APP_SECRET` | `string` | No | — | Feishu application secret. |
| `FEISHU_VERIFICATION_TOKEN` | `string` | No | — | Token for verifying Feishu webhook requests. |
| `FEISHU_ENCRYPT_KEY` | `string` | No | — | Encryption key for Feishu event payloads. |

## WeChat Enterprise Bot Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `WECHAT_BOT_ENABLED` | `boolean` | No | `false` | Enable WeChat Enterprise bot integration. |
| `WECHAT_CORP_ID` | `string` | No | — | WeChat Enterprise corporation ID. |
| `WECHAT_CORP_SECRET` | `string` | No | — | WeChat Enterprise application secret. |
| `WECHAT_TOKEN` | `string` | No | — | Token for verifying WeChat webhook requests. |
| `WECHAT_ENCODING_AES_KEY` | `string` | No | — | AES key for encrypting/decrypting WeChat messages. |
| `WECHAT_AGENT_ID` | `string` | No | — | WeChat Enterprise agent (application) ID. |

## Security Notes

- All API keys and tokens are used **server-side only** and are never exposed to the browser client.
- Store your `.env.local` file securely and do not commit it to version control.
- The `.gitignore` file already excludes `.env*` files (except `.env.example`).
