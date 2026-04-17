---
name: innoclaw-cli
description: Use the local InnoClaw CLI to run app workflows and Deep Research sessions from the terminal. Trigger when the user wants command-line control over this repository instead of only using the web UI.
---

# InnoClaw CLI

Use the `innoclaw` command from the repository root for local operation.

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

- `research create`, `research run`, and `research export` require the local app server to be running.
- `workspace add` expects a filesystem path that already exists on disk.
- The CLI is intentionally thin: it wraps existing repo commands and HTTP APIs rather than bypassing them.
