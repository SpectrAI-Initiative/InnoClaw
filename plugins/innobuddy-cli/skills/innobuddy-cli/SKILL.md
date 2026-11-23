---
name: innobuddy-cli
description: Use the local Innobuddy CLI to run app workflows and Deep Research sessions from the terminal. Trigger when the user wants command-line control over this repository instead of only using the web UI.
---

# Innobuddy CLI

Use the `Innobuddy` command from the repository root for local operation.

Bare `Innobuddy` starts the interactive CLI and treats the current shell directory as the workspace.

## Interactive and auth

```bash
Innobuddy
innobuddy auth status
innobuddy auth login
innobuddy auth logout
```

- Start the local Docker stack first. The CLI talks to `http://127.0.0.1:3000`.
- When auth is enabled, the CLI opens the browser login page and waits for a dedicated CLI session handoff.
- For a trusted headless run, set `AUTH_MODE=disabled` in `.env.docker.local` before starting the container.

## Non-interactive agent runs

```bash
innobuddy run --prompt "Summarize this workspace"
printf 'Create a plan for the current repo' | innobuddy run
innobuddy batch --input jobs.json --workers 4
```

## Command groups

### App lifecycle

```bash
innobuddy doctor
innobuddy app dev
innobuddy app build
innobuddy app lint
innobuddy app test
innobuddy app start
```

### Workspace management

```bash
innobuddy workspace list
innobuddy workspace add --name notebooklm --path "$PWD"
```

### Deep Research

```bash
innobuddy research list --workspace-id <workspace-id>
innobuddy research create --workspace-id <workspace-id> --title "Survey of time-series Transformer architectures" --content "Write a deep research report."
innobuddy research show --session-id <session-id>
innobuddy research run --session-id <session-id>
innobuddy research export --session-id <session-id>
```

## Base URL

- Defaults to `http://localhost:3000`
- Override with `--base-url` or `INNOBUDDY_BASE_URL`

## Usage notes

- `research create`, `research run`, and `research export` use the same local app runtime and auth flow as `Innobuddy`.
- `workspace add` expects a filesystem path that already exists on disk.
- `Innobuddy`, `run`, and `batch` auto-bind the current shell directory as a workspace if needed.
- The CLI stays thin: it wraps the existing local app and HTTP APIs rather than bypassing them.
