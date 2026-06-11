---
name: innoclaw-cli
description: Use the local InnoClaw CLI to run app workflows and Deep Research sessions from the terminal. Trigger when the user wants command-line control over this repository instead of only using the web UI.
---

# InnoClaw CLI

Use the `innoclaw` command from the repository root for local operation.

Bare `innoclaw` starts the interactive CLI and treats the current shell directory as the workspace.

## Interactive and auth

```bash
innoclaw
innoclaw auth status
innoclaw auth login
innoclaw auth logout
```

- The CLI auto-starts the local app on `localhost:3000` when needed.
- When auth is enabled, the CLI opens the browser login page and waits for a dedicated CLI session handoff.
- For headless and CI-style runs, start the app with `DISABLE_AUTH=true npm run dev`.

## Non-interactive agent runs

```bash
innoclaw run --prompt "Summarize this workspace"
printf 'Create a plan for the current repo' | innoclaw run
innoclaw batch --input jobs.json --workers 4
```

## Command groups

### App lifecycle

```bash
innoclaw doctor
innoclaw app dev
innoclaw app build
innoclaw app lint
innoclaw app test
innoclaw app start
```

### Workspace management

```bash
innoclaw workspace list
innoclaw workspace add --name notebooklm --path "$PWD"
```

### Deep Research

```bash
innoclaw research list --workspace-id <workspace-id>
innoclaw research create --workspace-id <workspace-id> --title "Survey of time-series Transformer architectures" --content "Write a deep research report."
innoclaw research show --session-id <session-id>
innoclaw research run --session-id <session-id>
innoclaw research export --session-id <session-id>
```

## Base URL

- Defaults to `http://localhost:3000`
- Override with `--base-url` or `INNOCLAW_BASE_URL`

## Usage notes

- `research create`, `research run`, and `research export` use the same local app runtime and auth flow as `innoclaw`.
- `workspace add` expects a filesystem path that already exists on disk.
- `innoclaw`, `run`, and `batch` auto-bind the current shell directory as a workspace if needed.
- The CLI stays thin: it wraps the existing local app and HTTP APIs rather than bypassing them.
