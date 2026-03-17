# Environment Variables

A complete reference of all environment variables used by InnoClaw.

## Core Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `WORKSPACE_ROOTS` | `string` | **Yes** | — | Comma-separated absolute paths where workspaces can be created. Directories must exist on the server. |
| `DATABASE_URL` | `string` | No | `./data/innoclaw.db` | SQLite database filesystem path. Set to a local path when the project resides on NFS or another network filesystem. |
| `NEXT_BUILD_DIR` | `string` | No | `.next` | Next.js build output directory. Set to a local filesystem path to avoid Turbopack cache errors on network/shared filesystems. |

## AI Provider Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `OPENAI_API_KEY` | `string` | No | — | OpenAI API key for chat and embedding. |
| `ANTHROPIC_API_KEY` | `string` | No | — | Anthropic API key for Claude models. |
| `GEMINI_API_KEY` | `string` | No | — | Google Gemini API key for Gemini models. |
| `SHLAB_API_KEY` | `string` | No | — | SH-Lab API key for Intern models. |
| `QWEN_API_KEY` | `string` | No | — | Qwen API key. |
| `MOONSHOT_API_KEY` | `string` | No | — | Moonshot API key for Kimi models. |
| `DEEPSEEK_API_KEY` | `string` | No | — | DeepSeek API key. |
| `MINIMAX_API_KEY` | `string` | No | — | MiniMax API key. |
| `ZHIPU_API_KEY` | `string` | No | — | Zhipu API key for GLM models. |
| `OPENAI_BASE_URL` | `string` | No | `https://api.openai.com/v1` | Custom OpenAI-compatible API endpoint (for proxies or third-party providers). |
| `ANTHROPIC_BASE_URL` | `string` | No | `https://api.anthropic.com` | Custom Anthropic API endpoint. |
| `GEMINI_BASE_URL` | `string` | No | — | Custom Gemini-compatible API endpoint (OpenAI-compatible proxy). |
| `SHLAB_BASE_URL` | `string` | No | — | Vendor-level base URL for all SH-Lab models. Per-model URLs (e.g. `SHLAB_INTERN_S1_PRO_BASE_URL`) take priority. |
| `QWEN_BASE_URL` | `string` | No | — | Vendor-level base URL for all Qwen models. Per-model URLs (e.g. `QWEN_QWEN3_235B_BASE_URL`) take priority. |
| `MOONSHOT_BASE_URL` | `string` | No | — | Vendor-level base URL for all Moonshot models. Per-model URLs (e.g. `MOONSHOT_KIMI_K2_5_BASE_URL`) take priority. |
| `DEEPSEEK_BASE_URL` | `string` | No | — | Vendor-level base URL for all DeepSeek models. Per-model URLs (e.g. `DEEPSEEK_DEEPSEEK_V3_2_BASE_URL`) take priority. |
| `MINIMAX_BASE_URL` | `string` | No | — | Vendor-level base URL for all MiniMax models. Per-model URLs (e.g. `MINIMAX_MINIMAX2_5_BASE_URL`) take priority. |
| `ZHIPU_BASE_URL` | `string` | No | — | Vendor-level base URL for all Zhipu models. Per-model URLs (e.g. `ZHIPU_GLM_5_BASE_URL`) take priority. |
| `LLM_PROVIDER` | `string` | No | `openai` | Default LLM provider: `openai`, `anthropic`, or `gemini`. Overridable in Settings UI. |
| `LLM_MODEL` | `string` | No | `gpt-4o-mini` | Default model ID. Overridable in Settings UI. |

:::{note}
At least one AI API key (OpenAI, Anthropic, or Gemini) is needed for AI chat and note generation features. Without any API key, workspace management, file browsing, and other non-AI features still work.
:::

## Agent Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `AGENT_MAX_STEPS` | `number` | No | `10` | Maximum agent tool-call steps per request (1–100). Higher values allow complex multi-step tasks but cost more tokens. |

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

## HuggingFace / ModelScope Datasets

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `HF_TOKEN` | `string` | No | — | HuggingFace access token. Avoids rate limits when downloading datasets. Also settable via the Settings UI. |
| `HF_DATASETS_PATH` | `string` | No | `./data/hf-datasets` | Local directory for downloaded HuggingFace/ModelScope datasets. |

## SCP Hub (Scientific Skills)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `SCP_HUB_API_KEY` | `string` | No | — | API key for the Intern-Discovery Platform, enabling 206 built-in SCP scientific skills (drug discovery, protein analysis, genomics, chemistry, etc.). |

## HTTP Proxy

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `HTTP_PROXY` | `string` | No | — | HTTP proxy for all outbound `fetch()` calls (AI API, GitHub, etc.). |
| `HTTPS_PROXY` | `string` | No | — | HTTPS proxy. Typically the same value as `HTTP_PROXY`. |
| `NO_PROXY` | `string` | No | — | Comma-separated hosts/CIDRs that bypass the proxy, e.g. `localhost,127.0.0.1,10.0.0.0/8`. |

## Feishu (Lark) Bot Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `FEISHU_BOT_ENABLED` | `boolean` | No | `false` | Enable Feishu bot integration. |
| `FEISHU_APP_ID` | `string` | No | — | Feishu application ID. |
| `FEISHU_APP_SECRET` | `string` | No | — | Feishu application secret. |
| `FEISHU_VERIFICATION_TOKEN` | `string` | No | — | Token for verifying Feishu webhook requests. |
| `FEISHU_ENCRYPT_KEY` | `string` | No | — | Encryption key for Feishu event payloads. |
| `FEISHU_PUSH_SECRET` | `string` | No | — | Shared secret for authenticating the push API (`/api/bot/feishu/push`). Required for web-to-Feishu message forwarding. |
| `FEISHU_LOG_LEVEL` | `string` | No | `info` | SDK log verbosity: `error`, `warn`, `info`, `debug`, `trace`. |

## WeChat Enterprise Bot Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `WECHAT_BOT_ENABLED` | `boolean` | No | `false` | Enable WeChat Enterprise bot integration. |
| `WECHAT_CORP_ID` | `string` | No | — | WeChat Enterprise corporation ID. |
| `WECHAT_CORP_SECRET` | `string` | No | — | WeChat Enterprise application secret. |
| `WECHAT_TOKEN` | `string` | No | — | Token for verifying WeChat webhook requests. |
| `WECHAT_ENCODING_AES_KEY` | `string` | No | — | AES key for encrypting/decrypting WeChat messages. |
| `WECHAT_AGENT_ID` | `string` | No | — | WeChat Enterprise agent (application) ID. |

## Kubernetes / Cluster Integration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `KUBECONFIG_PATH` | `string` | No | — | Path to your kubeconfig file for Kubernetes cluster access. |
| `K8S_SUBMITTER` | `string` | No | — | AD account name used as the job submitter identity. |
| `K8S_IMAGE_PULL_SECRET` | `string` | No | — | Kubernetes secret name for pulling container images. |
| `K8S_PVC_AI4S` | `string` | No | — | PersistentVolumeClaim name for AI4S shared storage. |
| `K8S_PVC_USER` | `string` | No | — | PersistentVolumeClaim name for user storage. |
| `K8S_PVC_AI4S_A2` | `string` | No | — | PersistentVolumeClaim name for AI4S A2 partition storage. |
| `K8S_MOUNT_USER` | `string` | No | — | Username for PVC mount path resolution. |

## Security Notes

- All API keys and tokens are used **server-side only** and are never exposed to the browser client.
- Store your `.env.local` file securely and do not commit it to version control.
- The `.gitignore` file already excludes `.env*` files (except `.env.example`).
