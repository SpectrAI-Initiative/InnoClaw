# Innobuddy CLI Plugin

`innobuddy-cli` adapts this repository into a repo-local Codex plugin plus a local terminal command.

## What it provides

- `Innobuddy` interactive TUI, using the current shell directory as the workspace
- `innobuddy run --prompt ...` for one-shot non-interactive agent runs
- `innobuddy batch --input ...` for JSON-driven batch runs
- `innobuddy auth status|login|logout`
- `innobuddy app dev|build|lint|test|start`
- `innobuddy doctor`
- `innobuddy workspace list|add`
- `innobuddy research list|create|show|run|export`

The CLI talks to the app at `http://127.0.0.1:3000`. Start the local Docker stack first with `scripts/docker-up-local.ps1` or `scripts/docker-up-local.sh`. For a trusted headless run, set `AUTH_MODE=disabled` in `.env.docker.local` before starting. Anyone who can reach the service then has administrator access.

## Local usage

From the repository root:

```bash
node plugins/innobuddy-cli/scripts/innobuddy-cli.mjs --help
```

To install the local command via npm shim:

```bash
npm link
innobuddy --help
```

## Examples

```bash
Innobuddy
innobuddy run --prompt "Summarize the current workspace"
printf 'Generate a plan for this repository' | innobuddy run
innobuddy batch --input jobs.json --workers 4
innobuddy auth login
innobuddy doctor
innobuddy app dev
innobuddy workspace list
innobuddy workspace add --name notebooklm --path "$PWD"
innobuddy research create --workspace-id <workspace-id> --title "Survey of time-series Transformer architectures" --content "Write a deep research report."
innobuddy research run --session-id <session-id>
innobuddy research export --session-id <session-id>
```

## Interactive login flow

When auth is enabled, the first interactive CLI command:

1. ensures the local app is running,
2. opens `http://localhost:3000/login` in your browser,
3. waits for browser sign-in or registration,
4. receives a dedicated CLI cookie triple through a localhost callback,
5. persists that CLI session in `~/.innobuddy/cli-sessions.json`.

The browser and CLI share the same user identity, but they do not reuse the same session token set.

## Headless run mode

```bash
# .env.docker.local contains AUTH_MODE=disabled
./scripts/docker-up-local.sh
innobuddy run --prompt "Summarize the current workspace"
```
