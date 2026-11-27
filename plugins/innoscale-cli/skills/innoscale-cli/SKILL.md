---
name: innoscale-cli
description: Use the local InnoScale CLI to run app workflows and Deep Research sessions from the terminal. Trigger when the user wants command-line control over this repository instead of only using the web UI.
---

# InnoScale CLI

Use the `InnoScale` command from the repository root for local operation.

Bare `InnoScale` starts the interactive CLI and treats the current shell directory as the workspace.

## Interactive and auth

```bash
InnoScale
innoscale auth status
innoscale auth login
innoscale auth logout
```

- Start the local Docker stack first. The CLI talks to `http://127.0.0.1:3000`.
- When auth is enabled, the CLI opens the browser login page and waits for a dedicated CLI session handoff.
- For a trusted headless run, set `AUTH_MODE=disabled` in `.env.docker.local` before starting the container.

## Non-interactive agent runs

```bash
innoscale run --prompt "Summarize this workspace"
printf 'Create a plan for the current repo' | innoscale run
innoscale batch --input jobs.json --workers 4
```

## Command groups

### App lifecycle

```bash
innoscale doctor
innoscale app dev
innoscale app build
innoscale app lint
innoscale app test
innoscale app start
```

### Workspace management

```bash
innoscale workspace list
innoscale workspace add --name notebooklm --path "$PWD"
```

### Deep Research

```bash
innoscale research list --workspace-id <workspace-id>
innoscale research create --workspace-id <workspace-id> --title "Survey of time-series Transformer architectures" --content "Write a deep research report."
innoscale research show --session-id <session-id>
innoscale research run --session-id <session-id>
innoscale research export --session-id <session-id>
```

## Base URL

- Defaults to `http://localhost:3000`
- Override with `--base-url` or `INNOSCALE_BASE_URL`

## Usage notes

- `research create`, `research run`, and `research export` use the same local app runtime and auth flow as `InnoScale`.
- `workspace add` expects a filesystem path that already exists on disk.
- `InnoScale`, `run`, and `batch` auto-bind the current shell directory as a workspace if needed.
- The CLI stays thin: it wraps the existing local app and HTTP APIs rather than bypassing them.
