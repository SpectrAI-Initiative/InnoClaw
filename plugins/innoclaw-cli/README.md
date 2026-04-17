# InnoClaw CLI Plugin

`innoclaw-cli` adapts this repository into a repo-local Codex plugin plus a local terminal command.

## What it provides

- `innoclaw app dev|build|lint|test|start`
- `innoclaw doctor`
- `innoclaw workspace list|add`
- `innoclaw research list|create|show|run|export`

The Deep Research commands call the existing HTTP API exposed by the local Next.js app. By default the CLI targets `http://localhost:3000`, or `INNOCLAW_BASE_URL` if set.

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
innoclaw doctor
innoclaw app dev
innoclaw workspace list
innoclaw workspace add --name notebooklm --path "$PWD"
innoclaw research create --workspace-id <workspace-id> --title "Survey of time-series Transformer architectures" --content "Write a deep research report."
innoclaw research run --session-id <session-id>
innoclaw research export --session-id <session-id>
```
