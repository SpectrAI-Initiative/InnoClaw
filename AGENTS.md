# InnoClaw Development Guidelines

This file is the repository-level source of truth for day-to-day development workflow. Supporting detail lives in `docs/development/`, while executable command truth lives in `package.json`, `docs/Makefile`, and GitHub Actions workflows.

## Source Of Truth

Use these files in this order when instructions conflict:

1. `AGENTS.md`
2. `package.json` scripts and `docs/Makefile`
3. `.github/workflows/*.yml`
4. Supporting narrative docs in `docs/development/`

## Supported Environment

- Node.js `24+` (`package.json` is authoritative; CI runs on Node 24 and 25)
- `npm` for dependency management and scripts
- Python `3.10+` for Sphinx documentation work (`docs/requirements.txt` currently pins `sphinx==8.1.3`)
- SQLite/Drizzle for local database migrations

## Repository Boundaries

Treat these directories as product code and documentation:

- `src/` application code
- `scripts/` repository scripts
- `drizzle/` database migrations
- `docs/` documentation sources
- `public/` shipped static assets
- `site/` docs homepage assets

Treat these directories as scratch space, references, or local-only artifacts. They are not part of routine app validation and must not be imported into shipped code:

- `reference/`
- `.worktrees/`
- `.superpowers/`
- `.venv-docs/`
- `batch-test-logs/`
- `test-results/`
- `tmp-playwright-review/`

## First-Time Setup

```bash
npm install
cp .env.example .env.local
mkdir -p data
npx drizzle-kit migrate
```

Then edit `.env.local` and set at least:

- `WORKSPACE_ROOTS`
- the API keys required for the provider(s) you plan to test

## Before You Start

- Run `git status --short` before large edits so you know whether you are entering a shared or dirty worktree.
- Identify the shared contracts your change may touch before coding. Common examples: schema, env vars, route response shapes, tool names, persisted session keys, and contributor-facing commands.
- Read the nearest source-of-truth files first: the relevant `package.json` script, nearby tests, and the matching page under `docs/development/`.
- Decide up front which validation commands and documentation updates your change will require. Do not wait until review time to discover missing follow-through.

## Daily Workflow

Start the app with either:

```bash
npm run dev
```

or the helper scripts:

```bash
bash dev-start.sh
bash dev-status.sh
bash dev-stop.sh
```

Use `npx tsc --noEmit` for a fast type-only pass when you do not need a full production build. The authoritative production verification remains `npm run build`.

## Validation Matrix

Run these checks before opening or updating a PR:

```bash
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

When documentation changes:

```bash
cd docs
make html
make html-zh
```

If your system `python3` is older than 3.10, create a dedicated docs virtualenv first:

```bash
python3.12 -m venv .venv-docs
.venv-docs/bin/python -m pip install -r docs/requirements.txt
```

When English docs change, refresh translations:

```bash
cd docs
make update-po
```

## Database Migration Rules

- Treat `src/lib/db/schema.ts` as the schema source of truth.
- When schema changes, generate and commit the matching migration under `drizzle/`.
- Apply migrations locally with `npx drizzle-kit migrate` before requesting review.
- Do not edit already-committed historical migrations unless you are intentionally fixing unreleased local work and understand the impact on existing databases.
- If a change touches seed/default skill data or migration helpers, review the affected files in `src/lib/db/` and verify the startup path that uses them.

## API Route Rules

- Keep `src/app/api/**/route.ts` focused on HTTP concerns: request parsing, auth/context checks, validation, status codes, and response shape.
- Move reusable or multi-step business logic into `src/lib/` or `src/core/`; avoid burying domain logic inside route handlers.
- Validate request params early and return explicit `4xx` responses for caller mistakes.
- For non-streaming JSON errors, prefer the shared helpers in `src/lib/api-errors.ts` when practical instead of duplicating response shapes.
- Add or update `route.test.ts` coverage when changing route behavior, validation, or error handling.

## Documentation Change Matrix

- If you change setup steps or local commands, update `AGENTS.md` and the relevant pages under `docs/development/`.
- If you add, rename, or remove environment variables, update `.env.example`, `docs/getting-started/environment-variables.md`, and any affected setup docs.
- If you change contributor workflow or validation expectations, update `CONTRIBUTING.md`, `docs/development/contributing.md`, and any README links that point contributors there.
- If you change architecture or directory boundaries, update `docs/development/project-structure.md`.
- If you change testing workflow, update `docs/development/testing.md`.
- If you change documentation workflow itself, update `docs/development/documentation.md`.

## Collaboration Rules

- Do not overwrite or revert unrelated local changes you did not make; treat a dirty worktree as shared state until you confirm otherwise.
- Keep changes scoped to one user-visible problem or one engineering concern. Split unrelated cleanup from behavior or contract changes.
- Re-read the latest file contents before editing areas that are actively changing or likely to be touched by others.
- When a change affects a shared contract, call it out explicitly in the PR or handoff summary. Shared contracts include schema, environment variables, route response shapes, tool names, and persisted localStorage/session keys.
- Include fresh verification evidence in your review or handoff summary instead of claiming success without command output.
- Prefer additive migration paths over silent rewrites when multiple developers or automation flows may depend on the current behavior.
- Prefer small, reviewable patches. If you intentionally leave follow-up work out of scope, say so directly instead of hiding it in TODO comments or broad summaries.

## Review And Handoff

When handing work to another developer, reviewer, or automation tool, include:

- what changed and why it matters
- which shared contracts or risky files need extra attention
- the exact validation commands you ran and the result you observed
- any known follow-ups, rollout notes, or unresolved risks

Use this structure when practical:

```text
Summary:
Contracts:
Validation:
Follow-ups:
```

## Agent Development Rules

- Keep prompts, provider wiring, tool registration, and orchestration logic out of UI components and route handlers whenever practical.
- Treat `src/lib/ai/tool-names.ts` and `src/lib/ai/tools/` as the central contract for tool availability and privilege boundaries.
- Default new agent capabilities to least privilege. High-risk tools should require explicit opt-in, matching the separation between `ALL_TOOLS` and `K8S_TOOLS`.
- Validate workspace paths, tool inputs, and execution context through shared helpers and typed context objects. Do not add raw filesystem or exec access that bypasses workspace validation.
- Keep streaming and resume behavior stable. If you change agent response streaming, review `src/lib/agent/agent-stream-manager.ts` and the corresponding UI flows together.
- Keep deep-research role definitions, doctrine loading, workflow policy, and UI assumptions synchronized across `src/lib/deep-research/`, `src/app/api/deep-research/`, and `src/components/deep-research/`.
- Any new tool, mode, provider, or role should ship with tests for its contract changes and with documentation updates where contributors need to understand the new behavior.
- High-risk execution paths, remote execution, and cluster operations must remain auditable and gated behind explicit configuration or approval boundaries.
- Prompt, doctrine, or role-text changes must live in code-backed prompt files or registries, not inline UI strings. Review dependent parsers, status names, and UI copy together.
- Tool additions or privilege-tier changes require allow/deny-path tests, stable naming, and docs updates if another contributor or operator needs to understand the capability.
- Session, streaming, or persistence changes must review the API route, runtime manager, and any localStorage or session-key consumers together so resume behavior does not silently regress.
- Prefer explicit failure states, logs, and surfaced status over silent fallbacks when changing agent orchestration or provider branching.

## Change Expectations

- Follow the existing feature-first structure in `src/components/` and domain structure in `src/lib/`.
- Keep route handlers in `src/app/api/` thin; put reusable logic in `src/lib/` or `src/core/`.
- Keep tests co-located as `*.test.ts` or `*.test.tsx`.
- Update docs when you change setup, environment variables, routes, workflows, or contributor-facing behavior.
- Do not commit secrets, `.env.local`, build output, or local-only scratch directories.

## Branches, Commits, And PRs

Preferred branch prefixes:

- `feature/`
- `fix/`
- `docs/`
- `chore/`

Use Conventional Commits:

```text
<type>(<scope>): <summary>
```

Examples:

- `feat(agent): add runtime capability probe`
- `fix(workspace): guard invalid root path`
- `docs(dev): refresh contributor workflow`

## Contributor Checklist

Before requesting review:

- Confirm the relevant validation commands pass locally
- Confirm docs are updated for developer-facing behavior changes
- Confirm tests cover new behavior or regressions where practical
- Confirm changes stay within repository boundaries and do not depend on local scratch content
