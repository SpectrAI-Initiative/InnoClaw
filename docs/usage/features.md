# Core Features

InnoClaw provides a rich set of features for AI-powered research and file management.

## Workspace Management

Workspaces map server-side folders into the application. Each workspace is a persistent container for files, chat history, and notes.

- **Create** workspaces from any allowed root directory (configured via `WORKSPACE_ROOTS`)
- **Open** existing workspaces from the home page
- **Delete** workspaces (removes only the database record; files on disk are preserved)
- **GitHub Clone** — Clone a GitHub repository directly as a new workspace

## File Browser

The file browser provides full file management within a workspace:

- **Tree View** — Hierarchical directory browsing with expand/collapse
- **Upload** — Drag-and-drop or click to upload files
- **Create** — New files and folders
- **Edit** — Open files in the built-in editor
- **Rename / Delete** — Right-click context menu
- **Preview** — Preview images, PDFs, 3D models (STL, OBJ, GLTF, etc.), and molecular structures (MOL)
- **Sync** — Trigger RAG indexing to enable AI-powered search

## RAG Chat

The AI chat interface uses Retrieval-Augmented Generation to answer questions based on your workspace files:

1. **Sync** your workspace to index files into the vector store
2. **Ask questions** in the chat panel
3. **Receive answers** with `[Source: filename]` citations pointing to the relevant files
4. **Multi-turn conversations** — Context is maintained across messages

### Supported File Types for RAG

The following file types are supported for text extraction and indexing:

| Category | Extensions |
|----------|------------|
| Documents | `.pdf`, `.txt`, `.md`, `.html` |
| Data | `.json`, `.csv` |
| Code | `.js`, `.ts`, `.py`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.rb`, `.php`, and more |

## Note Generation

Automatically generate structured notes from your workspace content:

| Type | Description |
|------|-------------|
| **Summary** | Concise overview of key points |
| **FAQ** | Frequently asked questions with answers |
| **Brief** | Executive-style briefing document |
| **Timeline** | Chronological sequence of events |
| **Memory** | Agent conversation memory summaries |
| **Daily Report** | Auto-generated daily workspace activity report |
| **Weekly Report** | Auto-generated weekly workspace activity report |

Notes can also be created and edited manually.

## Agent Mode

The Agent mode provides an autonomous AI assistant with access to system tools:

| Tool | Description |
|------|-------------|
| **bash** | Execute shell commands (configurable timeout up to 300s) |
| **readFile** | Read file contents within workspace |
| **writeFile** | Create or overwrite files |
| **listDirectory** | List directory contents with metadata |
| **grep** | Search file contents with regular expressions |
| **searchArticles** | Search arXiv and Hugging Face Daily Papers |
| **getSkillInstructions** | Load SCP scientific skill workflows |
| **kubectl** | Kubernetes cluster management (read-only by default) |
| **submitK8sJob** | Submit Volcano K8s jobs to Ascend 910B NPU clusters |
| **collectJobResults** | Collect K8s job logs and status |

Agent mode supports three sub-modes:

| Mode | Tools Available | Use Case |
|------|----------------|----------|
| **Agent** | All tools | Full autonomous execution |
| **Plan** | readFile, listDirectory, grep | Read-only analysis and planning |
| **Ask** | readFile, listDirectory, grep | Simple question answering |

## Skills

Skills are reusable AI workflow templates:

- **206 built-in SCP (Science Context Protocol) skills** from the Intern-Discovery Platform, covering 8 research domains:
  - Drug Discovery & Pharmacology (71 skills)
  - Genomics & Genetic Analysis (41 skills)
  - Protein Science & Engineering (38 skills)
  - Chemistry & Molecular Science (24 skills)
  - Physics & Engineering Computation (18 skills)
  - Experimental Automation & Literature Mining (7 skills)
  - Earth & Environmental Science (5 skills)
  - Cross-domain utility skills (2 skills)
- Create **custom skills** with specific system prompts and instructions
- Configure **allowed tools** per skill to control access
- Define **parameters** with `{{paramName}}` template injection
- Define **multi-step workflows** with tool hints per step
- **Import/export** skills as JSON for sharing

Skills can be triggered from the Agent panel or auto-matched based on user intent.

## Article / Paper Search

Search and study academic papers directly from the application:

- **Search Sources** — arXiv and Hugging Face Daily Papers
- **Filter** by keywords, date range, and source
- **Related Articles** — Find papers related to a given article
- **Paper Study UI** — Dedicated interface for searching, fetching, summarizing, and chatting about papers
- **Agent Integration** — The `searchArticles` tool is available in Agent mode

## Scheduled Tasks

Automate recurring operations with cron-based scheduled tasks:

| Task Type | Description |
|-----------|-------------|
| `daily_report` | Generate daily workspace activity report |
| `weekly_report` | Generate weekly workspace activity report |
| `git_sync` | Automatically pull Git repositories |
| `source_sync` | Re-index workspace files |
| `custom` | User-defined workflows |

Tasks can be global or workspace-specific, with execution tracking (status, errors, last run time).

## Dataset Management

Download and manage datasets from HuggingFace Hub and ModelScope:

- **Download** datasets, models, or spaces from HuggingFace or ModelScope
- **Import** existing local directories as datasets
- **Lifecycle** — Pause, resume, cancel, and retry downloads
- **Progress Tracking** — Real-time download progress monitoring (0–100%)
- **File Preview** — Preview dataset contents with split selection
- **Workspace Linking** — Link datasets to workspaces (many-to-many)
- **File Filtering** — Specify allow/ignore patterns for selective downloads

## Cluster / Kubernetes Integration

Monitor and manage Kubernetes clusters for GPU-accelerated workloads:

- **Cluster Status** — View nodes, jobs, and pods at a glance
- **kubectl / vcctl** — Execute cluster commands via Agent mode
- **Volcano Job Submission** — Submit jobs to Ascend 910B NPU clusters
- **Result Collection** — Collect job logs, status, and exit codes
- **Audit Trail** — Full operation history with workspace-level filtering

Requires `KUBECONFIG_PATH` and related `K8S_*` environment variables to be configured.

## Multi-LLM Support

Switch between different AI providers and models:

| Provider | Models |
|----------|--------|
| **OpenAI** | GPT-5.2, GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, GPT-4o, GPT-4o Mini, o3, o3 Mini, o4 Mini |
| **Anthropic** | Claude Opus 4.6, Claude Sonnet 4, Claude 3.7 Sonnet, Claude 3.5 Haiku |
| **Gemini** | Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 3 Flash, Gemini 3 Pro, Gemini 3.1 Pro (Thinking) |

Custom endpoints are supported via `OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, and `GEMINI_BASE_URL` for third-party providers or self-hosted models.

## Bilingual UI

The user interface supports both Chinese and English:

- Click the **language toggle** in the top navigation bar
- All UI elements, labels, and messages are translated
- Language preference is persisted across sessions

## Dark Mode

Toggle between light and dark themes:

- Click the **theme toggle** in the top navigation bar
- Applies to all panels including the file browser, chat, and editor
- Theme preference is persisted across sessions
