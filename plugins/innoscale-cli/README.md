# InnoScale CLI Plugin

`innoscale-cli` adapts this repository into a repo-local Codex plugin plus a local terminal command.

## What it provides

- `InnoScale` interactive TUI, using the current shell directory as the workspace
- `innoscale run --prompt ...` for one-shot non-interactive agent runs
- `innoscale batch --input ...` for JSON-driven batch runs
- `innoscale auth status|login|logout`
- `innoscale app dev|build|lint|test|start`
- `innoscale doctor`
- `innoscale workspace list|add`
- `innoscale research list|create|show|run|export`

The CLI talks to the app at `http://127.0.0.1:3000`. Start the local Docker stack first with `scripts/docker-up-local.ps1` or `scripts/docker-up-local.sh`. For a trusted headless run, set `AUTH_MODE=disabled` in `.env.docker.local` before starting. Anyone who can reach the service then has administrator access.

## Local usage

From the repository root:

```bash
node plugins/innoscale-cli/scripts/innoscale-cli.mjs --help
```

To install the local command via npm shim:

```bash
npm link
innoscale --help
```

## Examples

```bash
InnoScale
innoscale run --prompt "Summarize the current workspace"
printf 'Generate a plan for this repository' | innoscale run
innoscale batch --input jobs.json --workers 4
innoscale auth login
innoscale doctor
innoscale app dev
innoscale workspace list
innoscale workspace add --name notebooklm --path "$PWD"
innoscale research create --workspace-id <workspace-id> --title "Survey of time-series Transformer architectures" --content "Write a deep research report."
innoscale research run --session-id <session-id>
innoscale research export --session-id <session-id>
```

## Interactive login flow

When auth is enabled, the first interactive CLI command:

1. ensures the local app is running,
2. opens `http://localhost:3000/login` in your browser,
3. waits for browser sign-in or registration,
4. receives a dedicated CLI cookie triple through a localhost callback,
5. persists that CLI session in `~/.innoscale/cli-sessions.json`.

The browser and CLI share the same user identity, but they do not reuse the same session token set.

## Headless run mode

```bash
# .env.docker.local contains AUTH_MODE=disabled
./scripts/docker-up-local.sh
innoscale run --prompt "Summarize the current workspace"
```
