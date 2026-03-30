# InnoClaw

<p align="center">
  <img src="site/logos/20260316-112548.png" alt="InnoClaw Logo" width="200" />
</p>

<p align="center">
  <b>A self-hostable AI research workspace for grounded chat, paper study, scientific skills, and research execution.</b>
</p>

<p align="center">
  <i>Grounded over your files. Structured around papers. Ready for execution.</i>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="Apache 2.0 License"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-24%2B%20(LTS)%20%7C%2025%20Current-339933?logo=node.js&logoColor=white" alt="Node.js 24+ LTS or 25 Current"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml"><img src="https://github.com/SpectrAI-Initiative/InnoClaw/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/"><img src="https://img.shields.io/badge/Docs-Online-blue?logo=gitbook&logoColor=white" alt="Online Docs"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/stargazers"><img src="https://img.shields.io/github/stars/SpectrAI-Initiative/InnoClaw?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/SpectrAI-Initiative/InnoClaw/issues"><img src="https://img.shields.io/github/issues/SpectrAI-Initiative/InnoClaw" alt="GitHub Issues"></a>
</p>

<p align="center">
  <b>English</b> · <a href="docs/README_CN.md">简体中文</a> · <a href="docs/README_JA.md">日本語</a> · <a href="docs/README_FR.md">Français</a> · <a href="docs/README_DE.md">Deutsch</a>
</p>

<p align="center">
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/">Documentation</a> · <a href="#quick-start">Install & Use</a> · <a href="#community-support">Community</a>
</p>

<p align="center">
  <a href="#community-support">
    <img src="site/social/飞书体验群.png" alt="Join Feishu Community" width="200" />
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="#community-support">
    <img src="site/social/微信体验群.jpg" alt="Join WeChat Community" width="200" />
  </a>
  <br/>
  <sub>Scan to join our community · 扫码加入飞书/微信体验群</sub>
</p>

InnoClaw turns server-side folders into AI-native workspaces for grounded chat, paper study, scientific workflows, and research execution.

It is built for researchers, developers, labs, and self-hosters who want more than a generic chat UI: cited answers over real files, reusable skills, and a path from reading to execution.

<p align="center">
  <img src="public/innoclaw-flow.png" alt="InnoClaw Workflow" width="800" />
</p>

---

## 🔥 What's New

<!-- whats-new-start -->

#### 2026-03-26
- **Dynamic Model Discovery**: Agent panel now auto-fetches available models from each configured AI provider, merging live results with built-in model lists
- **Per-Model Base URL Routing**: Chinese AI providers (shlab, qwen, moonshot, deepseek, minimax, zhipu) now support per-model `<PROVIDER>_<MODEL>_BASE_URL` env vars for flexible endpoint routing
- **Runtime Tool-Calling Override**: Tool support can now be toggled per provider via `<PROVIDER>_TOOLS_ENABLED=true/false` without code changes


#### 2026-03-26
- **Node.js Runtime Update**: InnoClaw now targets Node.js 24+ and is verified against both Node.js 24 LTS and the latest Node.js 25 current release. CI and local version hints have been updated accordingly.



#### 2026-03-24
- **Multimodal LLM Support**: Paper Study and agent workflows now support both standard LLMs and multimodal LLMs (mLLM), selectable per-context in settings and the model selector



<details>
<summary>Show earlier updates</summary>

#### 2026-03-23
- **GitHub Skills Import Preview**: New pre-import preview workflow lets users browse, review, and selectively import skills from GitHub repositories before committing changes




#### 2026-03-22
- **Obsidian Note Export**: Generate structured, Obsidian-compatible paper notes with rich YAML frontmatter, figures, and wikilinks directly from the paper study panel
- **Per-Task Model Selector**: New model selector UI component lets users override the default AI model for individual paper study tasks (summary, roast, notes, etc.)
- **Note Discussion View**: New full-page discussion view for paper notes, enabling threaded AI-assisted conversations around generated note content





#### 2026-03-21
- **Remote HPC/SLURM Execution**: Deep research sessions can now run on remote clusters via SSH, supporting rjob, rlaunch, and SLURM schedulers with file staging and job lifecycle management
- **Kubernetes Cluster Config UI**: New settings panel for runtime configuration of K8s contexts, PVC bindings, and container images across multi-cluster deployments without restarting
- **Remote Profile Binding**: Deep research sessions can be bound to pre-configured SSH/remote compute profiles, enabling reproducible distributed research workflows







#### 2026-03-20
- **Deep Research Module**: Full AI-driven scientific research pipeline with multi-phase orchestration, reviewer deliberation, execution planning, and workflow graph UI
- **Execution Pipeline**: Automated experiment execution system with Slurm job submission, dataset management, preprocessing, and remote executor support








#### 2026-03-19
- **ClawHub Skill Import**: New integration to import skills directly from ClawHub via a dedicated API endpoint and import dialog
- **Code Preview Panel**: New in-editor code preview component supporting syntax highlighting and save-status tracking
- **Paper Study Cache**: Persistent caching layer for paper study sessions, improving reload performance and state continuity









#### 2026-03-18
- **Multimodal Vision for Paper Analysis**: PDF images are now extracted and analyzed visually during paper discussion and research ideation sessions
- **Claude Code Skills Integration**: Import skills directly from local folders or Claude Code projects via a new dedicated import workflow










#### 2026-03-18
- **Multimodal Vision for Paper Discussion & Ideation**: Vision-capable providers can now receive extracted PDF page images alongside text so discussion and ideation agents can analyze figures, tables, and diagrams.
- **Paper Pages Gallery UI**: Discussion and ideation panels now show a collapsible thumbnail gallery for extracted paper pages with full-size preview dialogs.
- **Provider Vision Capability Detection**: Provider configs now expose vision support so routes can switch between multimodal and text-only paper context automatically.










</details>


<!-- whats-new-end -->

---

## 🧭 What Is InnoClaw?

InnoClaw is a self-hostable web app for research-centric knowledge work. It combines workspace management, retrieval-augmented chat, paper search and review, reusable scientific skills, and agent-based execution in one place.

Instead of juggling separate tools for files, notes, literature review, and automation, you keep the workflow in one workspace: open a folder, sync content, ask grounded questions, study papers, and run multi-step research tasks.

## ✨ Why InnoClaw

- **Workspace-first** - Treat server folders as durable research workspaces with files, notes, chat history, and execution context
- **Grounded AI answers** - Use RAG-backed chat with source citations over your own documents and code
- **Research-native workflows** - Study papers, run structured multi-agent discussions, and generate new directions from literature
- **Scientific skills built in** - Import and use 206 SCP scientific skills across domains such as drug discovery, genomics, and protein science
- **Execution, not just conversation** - Move from reading and planning to job submission, monitoring, result collection, and next-step recommendations
- **Self-hosted and multi-model friendly** - Run with OpenAI, Anthropic, Gemini, and compatible endpoints in your own environment

<a id="quick-start"></a>

## 🚀 Quick Start

For a stable self-hosted deployment, prefer a tagged release over a moving `main` branch snapshot:
Runtime requirement:
- Node.js `24+` required
- Node.js `24 LTS` recommended for stable deployments
- Node.js `25 Current` is also supported

If you use `nvm`, you can follow the repo default:

```bash
nvm install
nvm use
```

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
git fetch --tags
# Optional but recommended for production:
# git checkout vX.Y.Z
```

InnoClaw requires Node.js 20+ (`package.json` is the source of truth for runtime requirements).

### 1. Install

```bash
npm install
cp .env.example .env.local
mkdir -p ./data /absolute/path/to/workspaces
npx drizzle-kit migrate
```

Set `WORKSPACE_ROOTS` in `.env.local` to one or more absolute local paths, for example:

```ini
WORKSPACE_ROOTS=/absolute/path/to/workspaces
OPENAI_API_KEY=sk-...
```

Notes:

- `WORKSPACE_ROOTS` directories must already exist before startup
- `npx drizzle-kit migrate` creates or upgrades the SQLite schema at `./data/innoclaw.db` by default
- If the repo lives on NFS/CIFS or another network filesystem, set `DATABASE_URL` and `NEXT_BUILD_DIR` to local disk paths in `.env.local`

### 2. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

### 3. First Use

After the UI opens:

1. Configure at least one model provider in `Settings`
2. Open an existing folder or create a workspace under `WORKSPACE_ROOTS`
3. Click `Sync` so InnoClaw builds the RAG index for that workspace
4. Start with grounded chat, then move into paper study, notes, skills, or research execution

### 4. Typical Usage Flow

- **Grounded chat**: ask questions over your files and code with citations
- **Paper study**: search papers, summarize them, and run structured multi-agent discussion
- **Skills**: import reusable scientific workflows and trigger them from the agent panel
- **Research execution**: review code, prepare jobs, submit to Shell/Slurm/`rjob`, and track artifacts

### 5. Keeping Versions Up to Date

Version changes matter because upgrades can introduce new environment variables, dependency changes, and database migrations.

- For production, pin to a release tag and upgrade deliberately instead of tracking `main`
- Check `CHANGELOG.md` before every upgrade
- Compare your `.env.local` against `.env.example` after pulling updates
- Re-run `npm install` and `npx drizzle-kit migrate` after every version bump

Recommended upgrade flow:

```bash
git fetch --tags
git checkout vX.Y.Z
npm install
npx drizzle-kit migrate
npm run build
```

If you intentionally track `main`, use:

```bash
git pull
npm install
npx drizzle-kit migrate
```

If the required Node.js major version changes between releases, reinstall dependencies under the new Node version before starting the app again.

Need OS-specific prerequisites or production setup? See `docs/getting-started/installation.md`, `docs/getting-started/deployment.md`, and `CHANGELOG.md`.

## 🛠️ What You Can Do

- Chat with local files and code using grounded citations
- Search, summarize, and review papers in one workspace
- Run 5-role structured paper discussions for critique and reproducibility thinking
- Generate summaries, FAQs, briefs, timelines, and research ideas
- Import scientific skills and trigger reusable domain workflows
- Manage remote research tasks with approval gates, monitoring, and result analysis

## 🗺️ Choose Your Path

| If you want to... | Start here | What happens next |
|-------------------|------------|-------------------|
| Chat with your own files | **Workspace + RAG Chat** | Open a folder, click `Sync`, and ask cited questions |
| Read and break down papers | **Paper Study** | Search papers, summarize them, then move into discussion or notes |
| Stress-test ideas with multiple perspectives | **Multi-Agent Discussion** | Run role-based reviews for critique, evidence gathering, and reproducibility thinking |
| Turn reading into new directions | **Research Ideation** | Generate directions, compare options, and save outputs into notes |
| Execute research work on remote infrastructure | **Research Execution Workspace** | Review code, approve changes, submit jobs, monitor runs, and collect results |

## 🧩 How It Fits Together

| Layer | Role in the workflow |
|-------|-----------------------|
| **Workspace** | Holds files, notes, session context, and project state |
| **Knowledge** | Syncs files into the RAG index so answers stay grounded |
| **Paper Workbench** | Handles literature search, summary, discussion, and ideation |
| **Skills** | Adds reusable domain workflows and tool-guided capabilities |
| **Execution** | Extends the workflow into remote jobs and experiment loops |

## 🔄 Core Workflows

### 📄 Paper Study

Search literature, preview papers, summarize them, and move directly into discussion or ideation.

- Search across multiple sources from one UI
- Use AI-assisted query expansion for broader coverage
- Open paper previews without leaving workspace context
- Save outputs into notes for reuse

### 🧠 Multi-Agent Discussion

Run a structured paper review with roles such as moderator, librarian, skeptic, reproducer, and scribe.

- Follow a deterministic staged discussion flow
- Compare evidence, methods, limitations, and reproducibility concerns
- Generate review records that are easier to scan than free-form chats
- Use full-paper context for deeper analysis

### 🧪 Research Execution Workspace

Go from code inspection to job submission and result analysis inside a guided execution workflow.

- Review repositories and propose patches with agent assistance
- Gate high-risk steps with explicit approval checkpoints
- Submit jobs through Shell, Slurm, or `rjob` backends
- Monitor status, collect artifacts, and generate recommendations for the next step

## 📦 Feature Snapshot

| Feature | What it enables |
|---------|------------------|
| Workspace Management | Map server folders into persistent AI workspaces |
| File Browser | Browse, upload, create, edit, preview, and sync files |
| RAG Chat | Ask grounded questions over indexed files with citations |
| Paper Study | Search, summarize, and inspect papers in one place |
| Discussion Mode | Run structured multi-role paper discussions |
| Research Ideation | Generate new directions and cross-disciplinary ideas |
| Skills System | Import reusable scientific and workflow skills |
| Research Execution | Orchestrate remote experiment loops with monitoring and approval gates |
| Multi-Agent Sessions | Keep separate execution contexts across tabs and projects |
| Multi-LLM Support | Use OpenAI, Anthropic, Gemini, and compatible endpoints |

## 📚 Documentation

- **Start here** - [Overview](docs/getting-started/overview.md), [Installation](docs/getting-started/installation.md)
- **Configure and deploy** - [Deployment](docs/getting-started/deployment.md), [Environment Variables](docs/getting-started/environment-variables.md), [Configuration](docs/usage/configuration.md)
- **Use the product** - [Features](docs/usage/features.md), [API Reference](docs/usage/api-reference.md)
- **Troubleshoot and contribute** - [Troubleshooting](docs/troubleshooting/faq.md), [Development Guide](docs/development/contributing.md)

<a id="community-support"></a>

## 💬 Community & Support

- **Need setup or usage help?** Start with the docs at https://SpectrAI-Initiative.github.io/InnoClaw/
- **Found a bug or want a feature?** Open an issue at https://github.com/SpectrAI-Initiative/InnoClaw/issues
- **Want direct discussion?** Join the Feishu community from `docs/README_CN.md`

## ℹ️ Project Info

- **License** - Apache-2.0, see `LICENSE`
- **Repository** - https://github.com/SpectrAI-Initiative/InnoClaw
- **Docs** - https://SpectrAI-Initiative.github.io/InnoClaw/

## ⭐ Star History

<a href="https://www.star-history.com/?repos=SpectrAI-Initiative%2FInnoClaw&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=SpectrAI-Initiative/InnoClaw&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=SpectrAI-Initiative/InnoClaw&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=SpectrAI-Initiative/InnoClaw&type=date&legend=top-left" />
 </picture>
</a>
