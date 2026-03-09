# Troubleshooting & FAQ

## Frequently Asked Questions

### Can I use InnoClaw without an API key?

**Yes.** Workspace management, file browsing, uploading, editing, and GitHub cloning features work without any API key. Only AI chat and note generation features require an API key. The UI will display a prompt indicating that AI features are unavailable.

### How do I use third-party compatible services (proxies, self-hosted models)?

Set `OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, or `GEMINI_BASE_URL` in your `.env.local` file to point to any API-compatible endpoint:

```ini
OPENAI_BASE_URL=https://api.your-proxy.com/v1
OPENAI_API_KEY=sk-your-key
```

If your proxy doesn't support the embedding endpoint, configure a separate embedding service:

```ini
EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_BASE_URL=https://api.your-embedding-proxy.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

### How do I configure Google Gemini?

Set `GEMINI_API_KEY` in your `.env.local` file. Optionally set `GEMINI_BASE_URL` if using a custom proxy:

```ini
GEMINI_API_KEY=your-gemini-key
# GEMINI_BASE_URL=https://api.your-provider.com
```

Then select "Gemini" as the provider in the Settings UI, or set the default:

```ini
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
```

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

For private HuggingFace repos, set `HF_TOKEN` in `.env.local` or via the Settings UI.

### How do I configure a proxy for outbound API calls?

Set `HTTP_PROXY` and `HTTPS_PROXY` in your `.env.local` file:

```ini
HTTP_PROXY=http://your-proxy:3128
HTTPS_PROXY=http://your-proxy:3128
NO_PROXY=localhost,127.0.0.1,10.0.0.0/8
```

All outbound `fetch()` calls (AI API, GitHub, HuggingFace, etc.) will route through the proxy. Hosts in `NO_PROXY` bypass it.

### Database errors on NFS or network filesystems

SQLite requires a local filesystem for reliable locking. If the project is on NFS/CIFS, set `DATABASE_URL` to a local path:

```ini
DATABASE_URL=/tmp/innoclaw/innoclaw.db
```

Also set `NEXT_BUILD_DIR` to avoid Turbopack cache errors:

```ini
NEXT_BUILD_DIR=/tmp/innoclaw-next
```

### How do I submit K8s / GPU jobs?

1. Configure Kubernetes access in `.env.local`:
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
2. Check that `GITHUB_TOKEN` is set correctly in `.env.local`
3. Ensure the token has the `repo` scope for private repositories
4. Check network connectivity to `github.com`

### How do I reset the database?

```bash
# Remove the database file
rm ./data/innoclaw.db

# Re-run migrations
npx drizzle-kit migrate
```

This creates a fresh database. All workspaces, chat history, notes, and settings will be lost, but workspace files on disk are not affected.

### How do I back up my data?

Back up the following:

| Item | Location |
|------|----------|
| Database | `./data/innoclaw.db` |
| Configuration | `.env.local` |
| Workspace files | Directories listed in `WORKSPACE_ROOTS` |

### The development server won't start

1. Ensure Node.js 18+ is installed: `node --version`
2. Ensure dependencies are installed: `npm install`
3. Ensure the database is initialized: `npx drizzle-kit migrate`
4. Ensure `WORKSPACE_ROOTS` directories exist on disk
5. Check for port conflicts on port 3000

### Build fails with font-related errors

If `npm run build` fails with errors about fetching Google Fonts, this is a network issue. Ensure your build environment has internet access, or configure Next.js to use local fonts.

### How do I change the port?

```bash
# Development
PORT=8080 npm run dev

# Production
PORT=8080 npm run start
```

## Getting Help

- **GitHub Issues** — [Report bugs or request features](https://github.com/zjowowen/InnoClaw/issues)
- **Documentation** — You're reading it! Check other sections for specific topics
- **Source Code** — The code is well-structured and documented; see [Project Structure](../development/project-structure.md)
