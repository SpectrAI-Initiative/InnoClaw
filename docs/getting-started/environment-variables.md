# Environment Variables

The container reads `.env.docker.local` or `.env.docker.online`. Those generated files stay untracked. Commit `config/secrets/docker.local.env` and `config/secrets/docker.online.env` instead. Secret values in those files are SSM references (`ssm:NAME`); `scripts/ssm-env.ps1` and `scripts/ssm-env.sh` load the plaintext from Tencent Cloud SSM in `ap-shanghai` before Docker starts. Do not create `.env.local` for the running app.

Paths such as `WORKSPACE_ROOTS` are inside the container. The host directory is `HOST_WORKSPACE_PATH`, mounted at `/research`.

## Core Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `WORKSPACE_ROOTS` | `string` | **Yes** | — | Comma-separated absolute paths where workspaces can be created. Directories must exist on the server. |
| `DATABASE_URL` | `string` | No | `./data/innoclaw.db` | SQLite database filesystem path. Set to a local path when the project resides on NFS or another network filesystem. |
| `AUTH_SECRET` | `string` | Recommended | Development fallback | Long random secret used to sign local authentication session cookies. Set this in production. |
| `AUTH_MODE` | `string` | No | `local` | Authentication mode. Set to `disabled` only for trusted local or single-user deployments to bypass registration/login and grant every request admin-level access. |
| `AUTH_SINGLE_ADMIN` | `boolean` | No | `false` | When `true`, requires exactly one bootstrapped active administrator. Public registration can create ordinary users only, and administrator role mutation is disabled. Values are strictly `true` or `false`. |
| `AUTH_COOKIE_SECURE` | `boolean` | No | `true` in production | Overrides the `Secure` attribute on authentication cookies. Set to `false` only during a temporary plain-HTTP rollout. Values are strictly `true` or `false`. |
| `NEXT_BUILD_DIR` | `string` | No | `.next` | Next.js build output directory inside the project root (for example `.next-local`). On Next.js 16 / Turbopack this cannot point outside the repo. |

With `AUTH_SINGLE_ADMIN=true`, run the administrator bootstrap command before
opening public registration. Ordinary users receive private roots at
`<WORKSPACE_ROOTS entry>/users/<immutable-user-id>`; the administrator retains
visibility across the configured operator roots.

## AI Provider Configuration

Chat and generation use Tencent Cloud TokenHub DeepSeek. The selectable models are `deepseek-v4.1-flash` and `deepseek-v4-pro`. Other vendor catalogs are archived and cannot be selected.

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | `string` | Yes for AI features | — | TokenHub API key used for DeepSeek Flash and Pro. |
| `DEEPSEEK_BASE_URL` | `string` | No | `https://tokenhub.tencentmaas.com/v1` | OpenAI-compatible TokenHub base URL. |
| `DEEPSEEK_DEEPSEEK_V4_1_FLASH_BASE_URL` | `string` | No | Vendor URL | Optional base URL override for Flash. |
| `DEEPSEEK_DEEPSEEK_V4_PRO_BASE_URL` | `string` | No | Vendor URL | Optional base URL override for Pro. |
| `LLM_PROVIDER` | `string` | No | `deepseek` | Active provider. Values outside the catalog fall back to `deepseek`. |
| `LLM_MODEL` | `string` | No | `deepseek-v4.1-flash` | Active model. Must be `deepseek-v4.1-flash` or `deepseek-v4-pro`. |

:::{note}
`DEEPSEEK_API_KEY` is required for AI chat and note generation. Without it, workspace management, file browsing, and other non-AI features still work.
:::

## Agent Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `AGENT_MAX_STEPS` | `number` | No | `10` | Maximum agent tool-call steps per request (1–100). Higher values allow complex multi-step tasks but cost more tokens. |

## Embedding API Configuration

These allow using a separate service for vector embeddings, independent of the chat model provider.

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `EMBEDDING_API_KEY` | `string` | No | — | API key for the embedding service. |
| `EMBEDDING_BASE_URL` | `string` | No | — | Endpoint for the embedding service. |
| `EMBEDDING_MODEL` | `string` | No | `text-embedding-3-small` | Name of the embedding model to use. |

**Example** — Using a dedicated embedding service:

```ini
DEEPSEEK_API_KEY=sk-your-tokenhub-key
DEEPSEEK_BASE_URL=https://tokenhub.tencentmaas.com/v1

EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_BASE_URL=http://your-embedding-provider/v1
EMBEDDING_MODEL=text-embedding-3-small
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
| `KUBECONFIG_PATH` | `string` | No | — | Path to the kubeconfig file used by generic Kubernetes Job tools. |
| `K8S_CONTEXT` | `string` | No | — | Kubeconfig context used by the generic Job profile fallback. |
| `K8S_DEFAULT_NAMESPACE` | `string` | No | `default` | Default namespace for the generic Job profile fallback. |
| `K8S_ALLOWED_NAMESPACES` | `string` | No | `K8S_DEFAULT_NAMESPACE` | Comma-separated namespace allow-list for generic Job tools. |
| `K8S_JOB_DEFAULT_IMAGE` | `string` | No | — | Default image for the generic Job profile fallback. |
| `K8S_JOB_PROFILE_ID` | `string` | No | `default` | Profile id used when env vars create the fallback profile. |
| `K8S_JOB_PROFILES_FILE` | `string` | No | — | Path to a private local JSON file containing generic clusters and Job profiles. |
| `K8S_JOB_PROFILES_JSON` | `string` | No | — | Inline JSON config for generic clusters and Job profiles. Use a file for private local values. |

## Security Notes

- All API keys and tokens are used **server-side only** and are never exposed to the browser client.
- `AUTH_MODE=disabled` removes application-level authentication. Anyone who can reach the service gets admin-level access, so use it only behind trusted local access or another access-control layer.
- `AUTH_SINGLE_ADMIN=true` fails closed until the administrator bootstrap has completed. Do not expose registration before that step.
- `AUTH_COOKIE_SECURE=false` only permits cookies over plain HTTP. It does not encrypt login credentials, session cookies, or application traffic; use HTTPS and restore the secure-cookie default as soon as possible.
- Startup uses only two untracked files: `.env.docker.local` (local) and `.env.docker.online` (online).
- Do not commit either file.
