# Troubleshooting & FAQ

## Frequently Asked Questions

### Can I use InnoClaw without an API key?

**Yes.** Workspace management, file browsing, uploading, editing, and GitHub cloning features work without any API key. Only AI chat and note generation features require an API key. The UI will display a prompt indicating that AI features are unavailable.

### How do I configure Tencent Cloud DeepSeek?

Set the TokenHub API key in `.env.docker.local` or `.env.docker.online`, then run the start script again. The default endpoint is TokenHub in Guangzhou:

```ini
DEEPSEEK_API_KEY=sk-your-tokenhub-key
DEEPSEEK_BASE_URL=https://tokenhub.tencentmaas.com/v1
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-v4.1-flash
```

The Settings page can switch `LLM_MODEL` to `deepseek-v4-pro`. Other providers are archived and are not shown.

### What is Agent mode and how does it differ from RAG Chat?

**RAG Chat** answers questions grounded in your workspace files using retrieval-augmented generation. It searches indexed files for relevant context and generates answers with source citations.

**Agent mode** provides an autonomous AI with tool access (bash, file operations, kubectl, article search, etc.). It can execute multi-step tasks, run commands, edit files, search papers, and submit K8s jobs. Agent mode supports three sub-modes:

- **Agent** — Full tool access for autonomous execution
- **Plan** — Read-only tools for analysis and planning
- **Ask** — Read-only tools for simple Q&A

### What file formats are supported for RAG indexing?

| Category | Extensions |
|----------|------------|
| Documents | `.pdf`, `.txt`, `.md`, `.html` |
| Data | `.json`, `.csv` |
| Code | `.js`, `.ts`, `.py`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.rb`, `.php`, and more |

### Is indexing slow for large workspaces?

The first sync processes all files (extract text → chunk → generate embeddings), which depends on the number and size of files. Subsequent syncs only process new or modified files (based on file hash comparison), making them significantly faster.

### Can I run InnoClaw on Linux?

**Yes.** Set `WORKSPACE_ROOTS` to Linux paths:

```ini
WORKSPACE_ROOTS=/home/user/research,/home/user/projects
```

### How do Scheduled Tasks work?

Scheduled tasks use cron expressions to automate recurring operations. The scheduler polls every 60 seconds and runs due tasks. Available task types:

| Type | Description |
|------|-------------|
| `daily_report` | Generate daily workspace activity report |
| `weekly_report` | Generate weekly workspace activity report |
| `git_sync` | Automatically pull Git repositories |
| `source_sync` | Re-index workspace files |
| `custom` | User-defined workflows |

Create tasks via the UI or the `POST /api/scheduled-tasks` endpoint with a cron expression (e.g., `"0 0 * * *"` for daily at midnight).

### How do I download a dataset from HuggingFace or ModelScope?

Use the **Datasets** page or the `POST /api/datasets` endpoint:

1. Navigate to the Datasets page
2. Enter the repository ID (e.g., `username/dataset-name`)
3. Select the source (HuggingFace or ModelScope)
4. Optionally set file patterns to include/exclude
5. Start the download

For private HuggingFace repos, set `HF_TOKEN` in the active Docker env file, or in the Settings UI.

### How do I configure a proxy for outbound API calls?

Set `HTTP_PROXY` and `HTTPS_PROXY` in the active Docker env file:

```ini
HTTP_PROXY=http://your-proxy:3128
HTTPS_PROXY=http://your-proxy:3128
NO_PROXY=localhost,127.0.0.1,10.0.0.0/8
```

All outbound `fetch()` calls (AI API, GitHub, HuggingFace, etc.) will route through the proxy. Hosts in `NO_PROXY` bypass it.

### How do I submit K8s / GPU jobs?

1. Configure Kubernetes access in the active Docker env file:
   ```ini
   KUBECONFIG_PATH=/path/to/your/kubeconfig
   K8S_SUBMITTER=your-ad-account
   K8S_IMAGE_PULL_SECRET=your-secret-name
   ```
2. Use Agent mode and ask the AI to submit a job, or use the `submitK8sJob` tool directly
3. Jobs require explicit user confirmation before submission (the agent will ask)
4. Use `collectJobResults` to retrieve logs and status after completion

See [Environment Variables](../getting-started/environment-variables.md) for all `K8S_*` configuration options.

### GitHub clone fails — what should I check?

1. Verify that `git` is installed: `git --version`
2. Check that `GITHUB_TOKEN` is set in the active Docker env file
3. Ensure the token has the `repo` scope for private repositories
4. Check network connectivity to `github.com`

### How do I reset the database?

Stop the stack, remove the `innoclaw-data` volume, and start again. That deletes chat history, notes, accounts, and the index. Files in the host workspace directory stay.

```bash
docker compose --env-file .env.docker.local -f docker-compose.yml -f docker-compose.local.yml down -v
.\scripts\docker-up-local.ps1
```

### How do I back up my data?

| Item | Location |
|------|----------|
| Database | Docker volume `innoclaw-data` at `/app/data/innoclaw.db` |
| Configuration | `.env.docker.local` or `.env.docker.online` |
| Workspace files | The host directory in `HOST_WORKSPACE_PATH` |

Use the backup command in [Docker Operations](../docker.md). Do not copy the live database file while SQLite may be using WAL.

### The container will not stay up

1. Docker Engine 24+ and Compose v2 are installed
2. `HOST_WORKSPACE_PATH` exists on the host
3. `DEEPSEEK_API_KEY` is set when you need chat
4. Port 3000 is free locally. Online, change `PUBLISH_PORT`
5. Read `docker compose logs innoclaw`

### Build fails with font-related errors

If `npm run build` fails with errors about fetching Google Fonts, this is a network issue. Ensure your build environment has internet access, or configure Next.js to use local fonts.

### How do I change the port?

Local Docker binds `127.0.0.1:3000`. On the online VM, set `PUBLISH_PORT` in `.env.docker.online` and run `./scripts/docker-up-online.sh` again.

## Getting Help

- **GitHub Issues** — [Report bugs or request features](https://github.com/SpectrAI-Initiative/InnoClaw/issues)
- **Documentation** — You're reading it! Check other sections for specific topics
- **Source Code** — The code is well-structured and documented; see [Project Structure](../development/project-structure.md)
