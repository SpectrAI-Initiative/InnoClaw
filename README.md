# InnoClaw

<p align="center">
  <img src="site/logos/20260316-112548.png" alt="InnoClaw Logo" width="200" />
</p>

<p align="center">
  <b>A self-hostable AI research workspace for grounded chat, paper study, scientific skills, and research execution.</b>
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
  <a href="https://SpectrAI-Initiative.github.io/InnoClaw/">Documentation</a> · <a href="#quick-start">Quick Start</a> · <a href="#community-support">Community</a>
</p>

**InnoClaw turns server-side folders into AI-native workspaces where you can chat over your own files, study papers, and run experiments — all in one place.**

Instead of juggling separate tools for literature, notes, code, and automation, you open a folder, sync it, and work: cited answers over real documents, structured paper reviews, reusable scientific skills, and a path from reading to remote execution.

<p align="center">
  <img src="public/innoclaw-flow.png" alt="InnoClaw Workflow" width="800" />
</p>

---

## Who This Is For

- **Researchers** who read papers, run experiments, and want cited AI answers grounded in their own files
- **ML / AI engineers** who need a workspace for code, data, and agent-assisted execution on remote clusters
- **Lab teams** who want a shared, self-hosted research hub instead of scattered SaaS tools
- **Self-hosters** who want full control over their data, models, and infrastructure

---

<a id="quick-start"></a>

## 3-Minute Quick Start

Requires **Node.js 24+** (`package.json` is the source of truth). If you use `nvm`: `nvm install && nvm use`.

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
npm install
cp .env.example .env.local          # then edit: set WORKSPACE_ROOTS and at least one API key
mkdir -p ./data
npx drizzle-kit migrate
npm run dev                          # open http://localhost:3000
```

After the UI opens: **Settings** → configure a model provider → open a workspace → click **Sync** → start chatting.

> **Security**: InnoClaw includes shell execution and remote job submission capabilities. See [SECURITY.md](SECURITY.md) for deployment hardening and trust boundary documentation.

<details>
<summary>Environment variables, upgrade flow, and advanced setup</summary>

Set `WORKSPACE_ROOTS` in `.env.local` to one or more absolute paths where your research folders live:

```ini
WORKSPACE_ROOTS=/absolute/path/to/workspaces
OPENAI_API_KEY=sk-...
```

- `WORKSPACE_ROOTS` directories must already exist before startup
- `npx drizzle-kit migrate` creates or upgrades the SQLite schema at `./data/innoclaw.db`
- If the repo lives on NFS/CIFS or another mount without local file locking, InnoClaw now disables Next's dist-dir lock automatically so `npm run dev` can start. You should still set `DATABASE_URL` to a local disk path for SQLite. `NEXT_BUILD_DIR`, if used, must stay inside the repo (for example `.next-local`).

**Upgrading:**

```bash
git fetch --tags
git checkout vX.Y.Z      # or: git pull (if tracking main)
npm install
npx drizzle-kit migrate
npm run build
```

Check `CHANGELOG.md` before every upgrade. Compare `.env.local` against `.env.example` for new variables.

For OS-specific prerequisites and production deployment: see [Installation](docs/getting-started/installation.md) and [Deployment](docs/getting-started/deployment.md).

</details>

### Docker Deployment

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git && cd InnoClaw
cp .env.production.example .env.production.local   # edit: set API key + WORKSPACE_ROOTS
docker compose up -d                                # open http://localhost:3000
```

See the full [Docker Deployment Guide](docs/docker.md) for volumes, reverse proxy, backups, and upgrades.

---

## Choose Your Path

InnoClaw supports three primary workflows. Pick the one that matches what you need today — you can always explore the others later.

### 1. Read & Study Papers

Search literature across ArXiv, PubMed, bioRxiv, and Semantic Scholar. Summarize papers, run structured multi-role discussions (moderator, skeptic, librarian, reproducer, scribe), and generate research ideation from what you read.

**Start here:** open Paper Study in any workspace.

### 2. Work in a Research Workspace

Open a server folder as a persistent workspace. Chat over your files with RAG-backed citations. Browse, edit, and sync files. Use the agent panel to run multi-step tasks with tool calling. Import reusable scientific skills across domains like drug discovery, genomics, and protein science.

**Start here:** create a workspace, click Sync, and ask a question.

### 3. Run Remote Experiments

Go from code inspection to job submission and result analysis. Review repositories with agent assistance, gate high-risk steps with approval checkpoints, submit jobs through Shell, Slurm, or `rjob`, and monitor execution across clusters.

**Start here:** open Deep Research in a workspace with remote profiles configured.

---

## What's New

<!-- whats-new-start -->

#### 2026-04-17
- **InnoClaw CLI**: Run the app, manage workspaces, and create/run/export Deep Research sessions from the terminal
- **Deep Research Checkpoints**: Research now pauses at review points so you can continue, revise, branch, reject, or stop runs
- **Role Studio**: New Deep Research tab to inspect specialist roles and send targeted instructions to the Researcher or workers


#### 2026-04-12
- **Docker Deployment Support**: Self-host InnoClaw with Docker and docker-compose, with guides for setup, volumes, and upgrades
- **200+ Built-in Skills**: Massive expansion of ready-to-use scientific skills across bioinformatics, chemistry, genomics, and physics
- **Skill Creator Framework**: New meta-skill for creating, evaluating, benchmarking, and validating custom skills



<details>
<summary>Show earlier updates</summary>

#### 2026-04-02
- **Docker Deployment Support**: Added Dockerfile, docker-compose.yml, and full Docker deployment guide for self-hosted production setups
- **200+ New Built-in Skills**: Expanded skill library with bioinformatics, cheminformatics, genomics, physics, and drug discovery pipelines
- **Skill Creator Framework**: New meta-skill with evaluation, benchmarking, and validation tooling for building and testing custom skills




#### 2026-04-01
- **Text-to-CAD Skill**: New agent skill that converts natural language descriptions into 3D CAD models (STL/STEP) using CadQuery, with automatic environment setup
- **Workspace Image Picker**: New dialog UI in the agent panel for browsing and selecting images from the workspace to attach to conversations





#### 2026-03-31
- **Pasted Image Support**: Users can now paste images directly into the chat input for multimodal AI conversations
- **Deep Research Role Studio**: New Role Studio panel lets users configure and manage custom researcher roles in the deep research workflow
- **Expanded Paper Search Sources**: Added BioRxiv, PubMed, and PubChem as searchable paper sources in Paper Study






#### 2026-03-26
- **Dynamic Model Discovery**: Agent panel now auto-fetches available models from each configured AI provider, merging live results with built-in model lists
- **Per-Model Base URL Routing**: Chinese AI providers (shlab, qwen, moonshot, deepseek, minimax, zhipu) now support per-model `<PROVIDER>_<MODEL>_BASE_URL` env vars for flexible endpoint routing
- **Runtime Tool-Calling Override**: Tool support can now be toggled per provider via `<PROVIDER>_TOOLS_ENABLED=true/false` without code changes







#### 2026-03-26
- **Node.js Runtime Update**: InnoClaw now targets Node.js 24+ and is verified against both Node.js 24 LTS and the latest Node.js 25 current release. CI and local version hints have been updated accordingly.








#### 2026-03-24
- **Multimodal LLM Support**: Paper Study and agent workflows now support both standard LLMs and multimodal LLMs (mLLM), selectable per-context in settings and the model selector








#### 2026-03-23
- **GitHub Skills Import Preview**: New pre-import preview workflow lets users browse, review, and selectively import skills from GitHub repositories before committing changes









#### 2026-03-22
- **Obsidian Note Export**: Generate structured, Obsidian-compatible paper notes with rich YAML frontmatter, figures, and wikilinks directly from the paper study panel
- **Per-Task Model Selector**: New model selector UI component lets users override the default AI model for individual paper study tasks (summary, roast, notes, etc.)
- **Note Discussion View**: New full-page discussion view for paper notes, enabling threaded AI-assisted conversations around generated note content










</details>


<!-- whats-new-end -->

---

## Feature Snapshot

| Feature | What it enables |
|---------|------------------|
| Workspace Management | Map server folders into persistent AI workspaces |
| File Browser | Browse, upload, create, edit, preview, and sync files |
| RAG Chat | Ask grounded questions over indexed files with citations |
| Paper Study | Search, summarize, and inspect papers from ArXiv, PubMed, bioRxiv, and more |
| Discussion Mode | Run structured multi-role paper discussions |
| Research Ideation | Generate new directions and cross-disciplinary ideas |
| Skills System | Import reusable scientific and workflow skills |
| Deep Research | AI-driven multi-phase research with workflow graph and role-based execution |
| Research Execution | Orchestrate remote experiment loops with monitoring and approval gates |
| Multi-Agent Sessions | Keep separate execution contexts across tabs and projects |
| Multi-LLM Support | Use OpenAI, Anthropic, Gemini, and compatible endpoints |

---

## Architecture

| Layer | Role |
|-------|-----------------------|
| **Workspace** | Files, notes, session context, and project state |
| **Knowledge** | RAG index over synced files for grounded answers |
| **Paper Workbench** | Literature search, summary, discussion, and ideation |
| **Skills** | Reusable domain workflows and tool-guided capabilities |
| **Execution** | Remote jobs, experiment loops, and result collection |

---

## Documentation

- **Start here** — [Overview](docs/getting-started/overview.md), [Installation](docs/getting-started/installation.md)
- **Configure and deploy** — [Deployment](docs/getting-started/deployment.md), [Environment Variables](docs/getting-started/environment-variables.md), [Configuration](docs/usage/configuration.md)
- **Use the product** — [Features](docs/usage/features.md), [API Reference](docs/usage/api-reference.md)
- **Troubleshoot and contribute** — [Troubleshooting](docs/troubleshooting/faq.md), [Development Guide](docs/development/contributing.md)

---

<a id="community-support"></a>

## Community & Support

- **Need setup or usage help?** Start with the [docs](https://SpectrAI-Initiative.github.io/InnoClaw/)
- **Found a bug or want a feature?** [Open an issue](https://github.com/SpectrAI-Initiative/InnoClaw/issues)
- **Want direct discussion?** Join the Feishu or WeChat communities below

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

---

## Project Info

- **License** — Apache-2.0, see `LICENSE`
- **Repository** — https://github.com/SpectrAI-Initiative/InnoClaw
- **Docs** — https://SpectrAI-Initiative.github.io/InnoClaw/

