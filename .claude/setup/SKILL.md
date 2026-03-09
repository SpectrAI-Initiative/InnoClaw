---
name: setup
description: Interactive setup wizard for VibeLab. Checks prerequisites, installs dependencies, configures environment, initializes database, and starts the dev server.
allowed-tools:
  - Bash(npm install:*)
  - Bash(node -e:*)
  - Bash(npx drizzle-kit:*)
  - Bash(npm run dev:*)
  - Bash(mkdir:*)
  - Bash(cp:*)
  - Bash(cat:*)
  - Bash(git:*)
  - Bash(which:*)
  - Bash(curl:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# VibeLab Setup Wizard

You are an interactive setup assistant for the VibeLab project. Guide the user through the complete installation and configuration process.

## Phase 1: Check Prerequisites

Verify the following are installed and meet minimum versions:

1. **Node.js** — Run `node --version`, require >= 20.9.0
2. **npm** — Run `npm --version`
3. **Git** — Run `git --version`

If any prerequisite is missing or below the required version, inform the user clearly and stop.

## Phase 2: Install Dependencies

Run `npm install` in the project root. If it fails:
- On compilation errors (better-sqlite3): suggest installing build tools (`build-essential python3` on Linux, `xcode-select --install` on macOS)
- On network errors: suggest using a mirror registry (`npm install --registry=https://registry.npmmirror.com`)

## Phase 3: Configure Environment

1. Check if `.env.local` already exists. If it does, ask the user whether to keep it or reconfigure.
2. If creating a new `.env.local`, copy from `.env.example` as a starting point, then ask the user for:

   **Required:**
   - `WORKSPACE_ROOTS` — Ask the user for one or more absolute directory paths (comma-separated). Verify each directory exists. If not, offer to create them with `mkdir -p`.

   **Recommended (AI features):**
   - Ask which AI provider they want to use: OpenAI / Anthropic / Gemini / skip for now
   - Based on their choice, ask for the corresponding API key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`)
   - If they use a custom API proxy, ask for the base URL (`OPENAI_BASE_URL`, `ANTHROPIC_BASE_URL`, or `GEMINI_BASE_URL`)

   **Optional (ask if they want to configure):**
   - `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` — Only if their AI proxy doesn't support embeddings
   - `GITHUB_TOKEN` — For cloning private repositories
   - `SCP_HUB_API_KEY` — For scientific skills (mention they can get a key at https://scphub.intern-ai.org.cn/)
   - Feishu Bot settings (`FEISHU_BOT_ENABLED`, `FEISHU_APP_ID`, etc.) — Only if they want to set up the Feishu bot
   - Network proxy (`HTTP_PROXY`, `HTTPS_PROXY`) — Only if they are in an internal network

3. Write the final `.env.local` file with all configured values. Comment out unused optional variables.

## Phase 4: Initialize Database

```bash
mkdir -p ./data && npx drizzle-kit migrate
```

Verify the database file was created at the expected path (default: `./data/vibelab.db`, or the path specified in `DATABASE_URL`).

## Phase 5: Start Development Server

Run `npm run dev` and inform the user:
- Open **http://localhost:3000** in their browser
- If they see the workspace list page, the setup is complete
- Remind them to click **"Sync"** in a workspace before using AI chat

## Phase 6: Summary

Print a summary of what was configured:
- Workspace roots
- AI provider configured (or skipped)
- Optional features enabled
- Database location
- How to start the server next time (`npm run dev`)
- How to configure advanced features: visit `/skills` page to import SCP scientific skills, Feishu bot, etc.
