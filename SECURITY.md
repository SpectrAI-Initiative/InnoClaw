# Security Policy

## Supported Versions

| Version | Status |
|---------|--------|
| 0.2.x   | Supported (current) |
| 0.1.x   | End-of-life — upgrade recommended |

Only the latest minor release receives security patches. Pin to `0.2.x` and watch releases for updates.

## Reporting a Vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

Use one of the following:

1. **GitHub Security Advisories** (preferred): click "Report a vulnerability" on the [Security tab](../../security/advisories).
2. **Email**: contact maintainers directly via the addresses on their GitHub profiles.

### What to Include

- Description of the vulnerability and potential impact
- Steps to reproduce
- Proof-of-concept code (if applicable)
- Affected version(s)
- Suggested fix (if any)

### Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | 48 hours |
| Initial assessment | 7 days |
| Fix for critical issues | 30 days |

### Disclosure Policy

- We follow coordinated disclosure and will credit reporters unless they prefer anonymity.
- Please allow reasonable time to address the vulnerability before any public disclosure.

---

## Deployment Hardening

InnoClaw is designed for **trusted, self-hosted environments**. It does not include built-in user authentication. Follow these guidelines before exposing any instance beyond `localhost`.

### Network

- Always run behind a reverse proxy (Nginx, Caddy, Traefik) with **HTTPS** enabled.
- **Never expose port 3000 directly to the public internet.**
- For remote access, use a VPN (Tailscale, WireGuard) or an authenticating reverse proxy (OAuth2 Proxy, Authelia, etc.).

### Secrets & Environment

- Never commit `.env.local` or API keys to version control. Use `.env.example` as a reference.
- Rotate API keys regularly; grant only the scopes each provider requires.
- Set restrictive file permissions on the SQLite database (`chmod 600 data/innoclaw.db`).

### Workspace Roots

`WORKSPACE_ROOTS` is the **primary filesystem access boundary**. The server can read, write, and execute within these directories. Restrict this to the minimum set of directories needed. Do not set it to `/` or a user's home directory.

### Docker

- Run the container as a non-root user (the provided `Dockerfile` does this by default).
- Mount only the directories you need as volumes.
- Do not bind-mount the Docker socket into the container.

---

## Trust Boundaries & Execution Capabilities

InnoClaw exposes several execution-heavy APIs. Understand these surfaces before deploying.

### Terminal API — `/api/terminal/exec`

- **What it does**: executes arbitrary shell commands with `child_process.exec()` in the working directory specified by the caller.
- **Boundaries**: the working directory must pass `WORKSPACE_ROOTS` path validation; commands have a 30-second timeout and 1 MB output buffer; the environment is sanitized via `buildSafeExecEnv()`.
- **Risk**: any user with HTTP access to this endpoint can run arbitrary commands on the host (within the workspace root). **This endpoint must not be reachable by untrusted users.**

### Remote Execution (Deep Research SSH Runner)

- **What it does**: runs commands on remote hosts over SSH (`src/lib/deep-research/remote-executor.ts`).
- **Boundaries**: controlled by SSH keys and host configuration provided via environment variables.
- **Recommendation**: if you don't use the deep-research remote execution feature, do not configure SSH credentials or `KUBECONFIG_PATH` in your environment.

### Kubernetes Job Submission

- **What it does**: submits Volcano batch jobs to configured K8s clusters (`src/lib/deep-research/exec-job-submitter.ts`, `src/lib/ai/tools/k8s-tools.ts`).
- **Boundaries**: scoped by the kubeconfig context and cluster RBAC policies.
- **Recommendation**: use a least-privilege service account. Restrict the kubeconfig to only the namespaces and verbs required.

### AI Agent Tool Calls

- **What it does**: the AI agent can invoke shell, git, and K8s tools during multi-step reasoning.
- **Boundaries**: `AGENT_MAX_STEPS` (default 10, max 100) limits the number of tool-call iterations per request.
- **Recommendation**: keep `AGENT_MAX_STEPS` at the default unless you understand the cost and execution implications.

---

## Summary Recommendation

For any deployment accessible beyond `localhost`, **add an authentication layer** before the InnoClaw server. Options include:

- Reverse proxy basic auth or mutual TLS
- OAuth2 Proxy / Authelia / Authentik
- Tailscale / WireGuard VPN
- Cloud IAP (GCP Identity-Aware Proxy, AWS ALB auth, Cloudflare Access)

InnoClaw assumes the network perimeter provides authentication. All API endpoints, including the terminal and agent APIs, are accessible to anyone who can reach the server.
