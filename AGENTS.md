# Innobuddy Development Guidelines

This file is the instruction set for changing the code. Cursor loads it into the coding agent on every turn. How to start the local container and how to deploy is `docs/开发说明.md`. Command names live in `package.json`.

When those sources conflict, use them in this order:

1. `AGENTS.md` for how to change the code
2. `package.json` scripts
3. `docs/开发说明.md` for running and deploying

There is no staging environment. The online VM is production. Do not run `./scripts/docker-up-online.sh`, edit the online env file, or try migrations against the online container until the change has been verified in the local container. Do not start the app with `npm run dev`, `npm run dev:no-auth`, `npm start`, or PM2.

Node.js `24+` (`package.json` `engines`). Use `npm`. The database is SQLite through Drizzle.

## Where Code Belongs

Product code and the runbook:

- `src/` application code
- `scripts/` repository scripts
- `drizzle/` database migrations
- `docs/开发说明.md` local and online runbook
- `public/` shipped static assets
- `site/` homepage images

Scratch. Do not import these into shipped code:

- `reference/`
- `.worktrees/`
- `.superpowers/`
- `.venv-docs/`
- `batch-test-logs/`
- `test-results/`
- `tmp-playwright-review/`

Do not commit secrets, `.env.docker.local`, `.env.docker.online`, or build output.

## Before Editing

- Run `git status --short` before a large edit. A dirty worktree is shared until you confirm otherwise. Do not overwrite or revert changes you did not make.
- Name the shared contract you might touch: schema, env vars, route response shapes, tool names, persisted session keys, contributor-facing commands.
- Keep one change to one user-visible problem. Re-read a file before editing it if it may have changed.
- If setup, deploy, or an operator-facing env var changes, update `docs/开发说明.md` in the same change. If a new env var is read at startup, update the start scripts that generate `.env.docker.local` and `.env.docker.online`.

## Validation

Before review:

```bash
npm run lint
npm test
npx tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 npm run build
```

`npm run build` runs `npm run verify:standalone`. The build fails if the standalone artifact is missing the compiled authentication proxy or contains runtime data, credentials, backups, repository source, tests, documentation, or local scratch. Keep new runtime paths outside the Docker build context. Change the verifier only when a shipped runtime asset is intentionally required.

`npx tsc --noEmit` is the fast type check. `npm run build` is the production check.

## Database

- `src/lib/db/schema.ts` is the schema source of truth.
- Generate and commit the matching migration under `drizzle/`.
- Apply it locally with `npx drizzle-kit migrate` before review.
- Do not edit an already committed migration unless you are fixing unreleased local work and know which databases it will affect.
- If seed data or migration helpers change, review `src/lib/db/` and the startup path that uses them.

## API Routes

- `src/app/api/**/route.ts` handles HTTP only: parsing, auth, validation, status codes, response shape.
- Put reusable logic in `src/lib/` or `src/core/`.
- Return `4xx` for caller mistakes. Use `src/lib/api-errors.ts` for non-streaming JSON errors.
- Cover behavior changes in the colocated `route.test.ts`.

## Agent, Tools, And Deep Research

- Keep prompts, provider wiring, tool registration, and orchestration out of UI components and route handlers.
- Tool availability and privilege boundaries live in `src/lib/ai/tool-names.ts` and `src/lib/ai/tools/`.
- New tools default to least privilege. High-risk tools require an explicit opt-in, the same split as `ALL_TOOLS` and `K8S_TOOLS`.
- A new tool, mode, provider, or role needs a stable name, allow and deny tests, and a `docs/开发说明.md` note only when an operator must configure it.
- Validate workspace paths, tool inputs, and execution context through shared helpers. Do not add filesystem or exec access that skips workspace validation.
- Prompt, doctrine, and role text live in code-backed prompt files or registries, not inline UI strings. Update parsers, status names, and UI copy together.
- Streaming or resume changes must be reviewed across the API route, `src/lib/agent/agent-stream-manager.ts`, and any localStorage or session-key consumer.
- Deep-research roles, doctrine, workflow policy, and UI assumptions stay aligned across `src/lib/deep-research/`, `src/app/api/deep-research/`, and `src/components/deep-research/`.
- Remote execution and cluster operations stay auditable and behind an explicit config or approval gate.
- Surface failures. Do not add a silent fallback when provider or orchestration branching changes.

## Layout And Tests

- Features live under `src/components/`. Domain logic lives under `src/lib/`.
- Tests sit next to the code as `*.test.ts` or `*.test.tsx`.

## Commits

Preferred branch prefixes: `feature/`, `fix/`, `docs/`, `chore/`.

```text
<type>(<scope>): <summary>
```

Examples: `feat(agent): add runtime capability probe`, `fix(workspace): guard invalid root path`.

## Handoff

State what changed and why, which shared contracts are risky, the validation commands and their results, and any follow-up. Use Summary, Contracts, Validation, Follow-ups when that fits.
