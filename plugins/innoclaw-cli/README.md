# InnoClaw CLI Plugin

`innoclaw-cli` adapts this repository into a repo-local Codex plugin plus a local terminal command.

## What it provides

- `innoclaw` interactive TUI, using the current shell directory as the workspace
- `innoclaw run --prompt ...` for one-shot non-interactive agent runs
- `innoclaw batch --input ...` for JSON-driven batch runs
- `innoclaw auth status|login|logout`
- `innoclaw app dev|build|lint|test|start`
- `innoclaw doctor`
- `innoclaw workspace list|add`
- `innoclaw research list|create|show|run|export`

The CLI keeps the local Next.js app as the runtime. By default it targets `http://localhost:3000`, auto-starts the local app when needed, opens the browser login page, and stores a dedicated CLI session for later reuse. For trusted headless runs, start the app with `npm run dev:no-auth` or set `AUTH_MODE=disabled`.

## Local usage

From the repository root:

```bash
node plugins/innoclaw-cli/scripts/innoclaw-cli.mjs --help
```

To install the local command via npm shim:

```bash
npm link
innoclaw --help
```

## Examples

```bash
innoclaw
innoclaw run --prompt "Summarize the current workspace"
printf 'Generate a plan for this repository' | innoclaw run
innoclaw batch --input jobs.json --workers 4
innoclaw auth login
innoclaw doctor
innoclaw app dev
innoclaw workspace list
innoclaw workspace add --name notebooklm --path "$PWD"
innoclaw research create --workspace-id <workspace-id> --title "Survey of time-series Transformer architectures" --content "Write a deep research report."
innoclaw research run --session-id <session-id>
innoclaw research export --session-id <session-id>
```

## Interactive login flow

When auth is enabled, the first interactive CLI command:

1. ensures the local app is running,
2. opens `http://localhost:3000/login` in your browser,
3. waits for browser sign-in or registration,
4. receives a dedicated CLI cookie triple through a localhost callback,
5. persists that CLI session in `~/.innoclaw/cli-sessions.json`.

The browser and CLI share the same user identity, but they do not reuse the same session token set.

## Headless run mode

```bash
npm run dev:no-auth
innoclaw run --prompt "Summarize the current workspace"
```
