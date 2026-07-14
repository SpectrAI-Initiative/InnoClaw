# Security Boundaries and Packaging Design

## Objective

Close the confirmed cross-user authorization gaps and prevent runtime data,
credentials, backups, source files, tests, and documentation from entering the
Next.js standalone artifact or production Docker image. Deliver the change on
an isolated branch, verify it locally and in Docker, merge it into `main`, push
`origin/main`, and deploy that exact revision to `106.75.210.30`.

This design does not include provider hot-reload changes, middleware public-path
cleanup, general lint cleanup, dependency upgrades, or synchronization to the
public `SpectrAI-Initiative/InnoClaw` remote.

## Current Failure Modes

The authorization audit found five route-level gaps:

1. `POST /api/agent/summarize` accepts a caller-supplied `workspaceId`, invokes
   the model, and inserts a note without checking workspace ownership.
2. `GET` and `PATCH /api/research-exec/runs/[runId]` read or update a run by ID
   without authorizing through the run's workspace.
3. `GET /api/skills?workspaceId=...` does not authorize the requested workspace
   and does not filter global skills by owner.
4. `GET /api/cluster/operations` exposes all recorded operation inputs and
   outputs when `workspaceId` is omitted.
5. `GET /api/cluster/status` exposes all-namespace Kubernetes status to every
   authenticated user, despite cluster execution being high-risk in strict
   single-administrator mode.

The packaging audit found that Turbopack traces the entire repository into
`.next/standalone`. The production Dockerfile copies that standalone directory
into the runner. On the deployed host, a pre-build `backups/` directory was
therefore embedded in the image, including an environment file, SQLite
database, source archive, and Nginx backup. The files are root-owned and not
readable by the runtime `nextjs` user, but remain extractable from image layers
by anyone with Docker or root access.

## Approaches Considered

### 1. Route-local checks and additional `.dockerignore` entries

Each affected route could duplicate ownership checks, while `.dockerignore`
could exclude the known `backups/` directory. This is the smallest patch, but
it leaves authorization semantics duplicated and allows future runtime
directories or Turbopack trace regressions to contaminate artifacts silently.

### 2. Shared authorization helpers plus layered packaging defenses

Add shared helpers for experiment-run access and high-risk route access, reuse
the existing workspace and owner filters, and add route-level regression tests.
For packaging, remove the whole-project trace trigger, use an allowlisted set of
Docker build inputs, expand `.dockerignore`, and make every `npm run build` fail
if the standalone artifact contains forbidden files.

This is the selected approach. It addresses the source of each problem and adds
an independent verification layer without changing schemas or public response
shapes unnecessarily.

### 3. Central policy middleware and a separate minimal runtime package

A larger redesign could declare authorization policies for every route and
build a dedicated runtime package outside Next.js standalone tracing. This would
provide stronger long-term structure, but it is too broad for a production
security hotfix and would increase regression risk.

## Authorization Design

### Workspace summary writes

`POST /api/agent/summarize` must call `requireWorkspaceAccess` immediately after
validating the request body and before model selection or generation. Preview
mode follows the same rule because it processes workspace-scoped conversation
content even when it does not write a note.

An inaccessible or missing workspace returns the existing authorization
response from `requireWorkspaceAccess`; no model request or database insert may
occur after that response.

### Experiment-run access

Add `requireExperimentRunAccess(request, runId)` to
`src/lib/auth/ownership.ts`. The helper authenticates the request, joins
`experiment_runs` to `workspaces`, applies `ownedWorkspaceFilter(auth)`, and
returns both the authenticated context and the selected run. Administrators and
disabled-auth development mode retain their existing access semantics.

Both `GET` and `PATCH /api/research-exec/runs/[runId]` must use this helper.
`PATCH` authorizes before parsing or applying mutable fields and returns the
updated row only after a successful authorized update.

### Skill listing

`GET /api/skills` continues to show project-default skills whose
`owner_user_id` is null. It may also show skills owned by the current ordinary
user. It must never show another ordinary user's global or workspace skill.

When a `workspaceId` is supplied, the route first calls
`requireWorkspaceAccess`. Its query then combines the requested scope with
`ownedSkillFilter(auth)`. When no workspace is supplied, the query lists only
accessible global skills. Administrators retain visibility across owners.

### Cluster operation history

The route must always authenticate explicitly instead of relying only on
middleware. A request with `workspaceId` may list operations only after
`requireWorkspaceAccess` succeeds. A request without `workspaceId` is an
all-workspaces query and therefore requires high-risk privilege.

In strict single-administrator mode, only the administrator may perform the
all-workspaces query. Disabled-auth development and non-strict legacy mode keep
the current `canUseHighRiskExecution` behavior.

### Cluster status

Add `requireHighRiskExecution(request)` beside
`canUseHighRiskExecution`. It calls `requireAuth`, applies the existing
privilege policy, and returns an explicit 403 response when the caller lacks
high-risk access.

`GET /api/cluster/status` must call this helper before loading Kubernetes
configuration or invoking `kubectl`. This guarantees that an ordinary user in
strict mode cannot trigger cluster reads or observe node, namespace, job, or Pod
metadata.

## Packaging Design

### Use deterministic production output tracing

Investigation disproved the initial hypothesis that the `next.config.ts`
import of `src/lib/dev/project-filesystem.ts` caused the contamination:
removing that import did not change the trace, and Turbopack ignore annotations
on runtime filesystem calls did not reliably prevent whole-project tracing.
The production build therefore uses `next build --webpack`.

Webpack reduces the trace to actual route dependencies. Exact
`outputFileTracingExcludes` entries remove only known redundant copies: local
`data/` and `.claude/` state, two dynamically imported TypeScript modules whose
compiled code is already in server chunks, and two bundled translation JSON
files. The standalone verifier remains the independent guard against any new
source or runtime path entering the artifact.

### Preserve the authentication request boundary

Because the App Router lives under `src/app`, Next.js 16 requires the request
boundary at `src/proxy.ts`. The legacy root `middleware.ts` was not compiled,
so a production container could render protected pages while route handlers
still returned 401. Move the file to `src/proxy.ts`, rename its exported
function to `proxy`, and require the standalone artifact to contain both the
compiled proxy bundle and its `/_middleware` function registration.

### Restrict Docker build inputs

Replace the builder-stage `COPY . .` with explicit copies of the files and
directories required for the application build and administrator CLI:

- package manifests and TypeScript/Next/PostCSS configuration
- `src/`, `public/`, `scripts/`, `drizzle/`, `config/`, and `plugins/`
- `.env.example` and `.env.production.example` as non-secret templates

The runner continues to receive the verified standalone output, static assets,
public assets, administrator CLI, migrations, and required native dependencies.
No host runtime directory is a legal Docker input.

Expand `.dockerignore` to exclude repository scratch directories and runtime
state, including `backups/`, `logs/`, `outputs/`, `workspaces/`, `.worktrees/`,
`.superpowers/`, `reference/`, `.venv-docs/`, `batch-test-logs/`, `test-results/`,
and `tmp-playwright-review/`.

### Make contamination a build failure

Add a repository script that recursively inspects `.next/standalone` and exits
non-zero if it finds any of these categories:

- active environment files or secret-bearing backup paths
- SQLite databases, WAL, or SHM files
- runtime directories such as `data/`, `backups/`, `logs/`, `outputs/`, or
  `workspaces/`
- repository source, tests, documentation, worktrees, Git metadata, or local
  scratch directories

Non-secret templates `.env.example` and `.env.production.example` are allowed.
Wire the verifier into the npm build lifecycle so local builds, CI, and Docker
builds all enforce the same gate.

The verifier is defense in depth. The trace fix and Docker allowlist are still
required even when the verifier passes.

## Testing Strategy

Follow red-green-refactor for each authorization behavior:

- summarization denies an inaccessible workspace before generation or insert
- experiment-run GET and PATCH deny a run from another user's workspace while
  allowing its owner and an administrator
- skill listing denies an inaccessible requested workspace and filters another
  user's global skills
- cluster operation history requires an accessible workspace for ordinary
  users and high-risk privilege for an unscoped query
- cluster status returns 403 before reading config or invoking `kubectl` for an
  ordinary strict-mode user

For packaging, first run the new verifier against the currently contaminated
standalone output and observe the expected failure. After correcting tracing,
run a fresh production build and require the verifier to pass. Build the Docker
image from a synthetic context containing sentinel `backups/`, `data/`, and
environment files, then inspect the image filesystem and confirm none of the
sentinels or forbidden paths exist.

Start the image with local authentication enabled and verify that `/` and
`/admin/users` redirect to login, public login and registration pages load,
and a protected API returns 401. This catches a missing or misplaced Next.js
request proxy even when the application itself compiles.

Before integration, run:

```bash
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

The build output must have no whole-project tracing warning. The branch must be
clean apart from committed changes.

## Deployment and Rollback

Build and inspect a local image before merging. After review, fast-forward
`main`, push the exact commit to `origin/main`, and deploy that revision on
`106.75.210.30` under a commit-derived image tag.

Before replacing the container, record the current image ID and preserve a
rollback tag. Reuse the existing host-side environment file and persistent
volumes; do not copy them into the build context. Apply no database migration
because this design changes no schema.

Post-deployment checks must verify:

- the container runs as `nextjs`, remains bound to `127.0.0.1:3000`, and has no
  restart loop
- public HTTP redirects unauthenticated users to `/login`
- registration remains available and protected APIs return 401 without a
  session
- the live image contains no forbidden paths or backup artifacts
- the configured `gpt-5.6-sol` model still succeeds with `xhigh` through the
  server environment

After the new deployment is stable, remove the contaminated superseded image
tag from the host. Preserve the host backup directory itself. If evidence shows
the contaminated image was exported or published, rotate the API key and
`AUTH_SECRET`; otherwise credential rotation remains a separate operational
decision.

## Success Criteria

The work is complete only when all of the following are true:

1. All five authorization gaps have failing-before/passing-after regression
   tests, and the Next.js authentication proxy is compiled and exercised by a
   container HTTP smoke test.
2. A fresh standalone artifact and Docker image contain no forbidden runtime,
   secret, database, backup, source, test, or documentation files.
3. Lint, the full test suite, and a production build pass.
4. The reviewed branch is merged into `main` and the same commit is present on
   `origin/main`.
5. Production runs an image built from that commit and passes the public,
   container, image-content, and model smoke tests.
6. The superseded contaminated application image is no longer retained on the
   server after the rollback window closes.
