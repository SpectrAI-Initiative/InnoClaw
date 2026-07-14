# Security Boundaries and Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Close the five confirmed cross-user authorization gaps and guarantee that standalone and Docker release artifacts cannot contain runtime data, secrets, backups, repository source, tests, or documentation, then merge, push, and deploy the verified commit.

**Architecture:** Centralize experiment-run ownership and high-risk route checks in the existing auth library. Remove the Turbopack whole-project trace trigger, restrict Docker builder inputs to an allowlist, and run a standalone artifact verifier after every production build. Build production from a clean Git archive instead of the mutable server checkout.

**Tech Stack:** Next.js 16 App Router, TypeScript 6, Vitest 4, Drizzle ORM/SQLite, Node.js 24, Docker Compose, Nginx, SSH.

---

### Task 1: Add shared experiment-run and high-risk access contracts

**Files:**
- Modify: src/lib/auth/ownership.ts
- Modify: src/lib/auth/ownership.test.ts
- Modify: src/lib/auth/privileges.ts
- Modify: src/lib/auth/privileges.test.ts

- [ ] **Step 1: Write failing experiment-run helper tests**

Extend ownership.test.ts with a controlled joined-row mock and these behaviors:

~~~typescript
function mockExperimentRunRow(
  row: { id: string; workspaceId: string } | undefined,
): void {
  const limit = vi.fn().mockResolvedValue(row ? [{ run: row }] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  vi.spyOn(db, "select").mockReturnValue({ from } as never);
}

it("returns an accessible experiment run with its auth context", async () => {
  serverMocks.requireAuth.mockResolvedValue(localAuth);
  mockExperimentRunRow({ id: "run-a", workspaceId: "workspace-a" });

  const result = await requireExperimentRunAccess(
    new NextRequest("http://localhost/api/research-exec/runs/run-a"),
    "run-a",
  );

  expect(result).toMatchObject({
    auth: localAuth,
    run: { id: "run-a", workspaceId: "workspace-a" },
  });
});

it("returns 403 when an experiment run is outside the caller's workspaces", async () => {
  serverMocks.requireAuth.mockResolvedValue(localAuth);
  mockExperimentRunRow(undefined);

  const result = await requireExperimentRunAccess(
    new NextRequest("http://localhost/api/research-exec/runs/run-b"),
    "run-b",
  );

  expect(result).toBeInstanceOf(NextResponse);
  expect((result as NextResponse).status).toBe(403);
});
~~~

- [ ] **Step 2: Run the ownership test and verify RED**

Run:

~~~bash
npx vitest run src/lib/auth/ownership.test.ts
~~~

Expected: FAIL because requireExperimentRunAccess is not exported.

- [ ] **Step 3: Implement the experiment-run helper**

Import experimentRuns and add:

~~~typescript
export async function requireExperimentRunAccess(
  request: NextRequest,
  runId: string,
): Promise<{
  auth: AuthContext;
  run: typeof experimentRuns.$inferSelect;
} | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const [row] = await db
    .select({ run: experimentRuns })
    .from(experimentRuns)
    .innerJoin(workspaces, eq(experimentRuns.workspaceId, workspaces.id))
    .where(and(eq(experimentRuns.id, runId), ownedWorkspaceFilter(auth)))
    .limit(1);

  if (!row) return forbiddenResponse("Experiment run access denied");
  return { auth, run: row.run };
}
~~~

- [ ] **Step 4: Run the ownership test and verify GREEN**

Run:

~~~bash
npx vitest run src/lib/auth/ownership.test.ts
~~~

Expected: all ownership tests PASS.

- [ ] **Step 5: Write failing high-risk request helper tests**

Mock requireAuth in privileges.test.ts and add:

~~~typescript
it("returns 403 for an ordinary strict-mode request", async () => {
  process.env.AUTH_MODE = "local";
  process.env.AUTH_SINGLE_ADMIN = "true";
  serverMocks.requireAuth.mockResolvedValue(authContext("user"));

  const result = await requireHighRiskExecution(
    new NextRequest("http://localhost/api/cluster/status"),
  );

  expect(result).toBeInstanceOf(NextResponse);
  expect((result as NextResponse).status).toBe(403);
});

it("returns the administrator context for a privileged request", async () => {
  process.env.AUTH_MODE = "local";
  process.env.AUTH_SINGLE_ADMIN = "true";
  const admin = authContext("admin");
  serverMocks.requireAuth.mockResolvedValue(admin);

  await expect(requireHighRiskExecution(
    new NextRequest("http://localhost/api/cluster/status"),
  )).resolves.toEqual(admin);
});
~~~

- [ ] **Step 6: Run privilege tests and verify RED**

Run:

~~~bash
npx vitest run src/lib/auth/privileges.test.ts
~~~

Expected: FAIL because requireHighRiskExecution does not exist.

- [ ] **Step 7: Implement the high-risk helper**

~~~typescript
import { NextRequest, NextResponse } from "next/server";
import { forbiddenResponse, requireAuth, type AuthContext } from "./server";

export async function requireHighRiskExecution(
  request: NextRequest,
): Promise<AuthContext | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!canUseHighRiskExecution(auth)) {
    return forbiddenResponse("High-risk execution access required");
  }
  return auth;
}
~~~

- [ ] **Step 8: Verify and commit**

Run:

~~~bash
npx vitest run src/lib/auth/ownership.test.ts src/lib/auth/privileges.test.ts
git add src/lib/auth/ownership.ts src/lib/auth/ownership.test.ts src/lib/auth/privileges.ts src/lib/auth/privileges.test.ts
git commit -m "fix(auth): add shared run and high-risk access guards"
~~~

Expected: both suites PASS and the commit succeeds.

### Task 2: Guard agent summarization before model or database work

**Files:**
- Create: src/app/api/agent/summarize/route.test.ts
- Modify: src/app/api/agent/summarize/route.ts

- [ ] **Step 1: Write a failing route regression test**

Mock generateText, provider functions, the database, and requireWorkspaceAccess. The central assertion is:

~~~typescript
it("rejects an inaccessible workspace before generation or insertion", async () => {
  mocks.requireWorkspaceAccess.mockResolvedValue(
    NextResponse.json({ error: "Workspace access denied" }, { status: 403 }),
  );

  const response = await POST(new NextRequest(
    "http://localhost/api/agent/summarize",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: "workspace-b",
        messages: [
          { role: "user", parts: [{ type: "text", text: "secret" }] },
        ],
      }),
    },
  ));

  expect(response.status).toBe(403);
  expect(mocks.requireWorkspaceAccess).toHaveBeenCalledWith(
    expect.any(NextRequest),
    "workspace-b",
  );
  expect(mocks.generateText).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
~~~

The mocks must make isAIAvailable return true and must not touch the real database.

- [ ] **Step 2: Run the test and verify RED**

Run:

~~~bash
npx vitest run src/app/api/agent/summarize/route.test.ts
~~~

Expected: FAIL because the route does not call requireWorkspaceAccess.

- [ ] **Step 3: Add the early workspace guard**

Import requireWorkspaceAccess and add immediately after required-field validation:

~~~typescript
const access = await requireWorkspaceAccess(req, workspaceId);
if (access instanceof NextResponse) return access;
~~~

- [ ] **Step 4: Verify and commit**

Run:

~~~bash
npx vitest run src/app/api/agent/summarize/route.test.ts
git add src/app/api/agent/summarize/route.ts src/app/api/agent/summarize/route.test.ts
git commit -m "fix(auth): guard workspace summary writes"
~~~

Expected: focused test PASS and the commit succeeds.

### Task 3: Authorize experiment-run reads and writes

**Files:**
- Create: src/app/api/research-exec/runs/[runId]/route.test.ts
- Modify: src/app/api/research-exec/runs/[runId]/route.ts

- [ ] **Step 1: Write failing GET and PATCH tests**

Mock requireExperimentRunAccess to return 403 and mock database queries so the current unprotected route would otherwise succeed:

~~~typescript
it.each([
  ["GET", () => GET(request("GET"), context)],
  ["PATCH", () => PATCH(request("PATCH", { status: "running" }), context)],
])("rejects unauthorized %s access before database mutation", async (_method, invoke) => {
  mocks.requireExperimentRunAccess.mockResolvedValue(
    NextResponse.json(
      { error: "Experiment run access denied" },
      { status: 403 },
    ),
  );

  const response = await invoke();

  expect(response.status).toBe(403);
  expect(mocks.requireExperimentRunAccess).toHaveBeenCalledWith(
    expect.any(NextRequest),
    "run-b",
  );
  expect(mocks.update).not.toHaveBeenCalled();
});
~~~

- [ ] **Step 2: Run the test and verify RED**

Run:

~~~bash
npx vitest run 'src/app/api/research-exec/runs/[runId]/route.test.ts'
~~~

Expected: tests FAIL because GET and PATCH do not call the helper.

- [ ] **Step 3: Use the shared helper in both methods**

Change GET to accept req instead of _req. In both methods, authorize immediately after reading runId:

~~~typescript
const access = await requireExperimentRunAccess(req, runId);
if (access instanceof NextResponse) return access;
~~~

GET serializes access.run. PATCH authorizes before parsing the request body, updates access.run.id, and returns the selected updated row.

- [ ] **Step 4: Verify and commit**

Run:

~~~bash
npx vitest run 'src/app/api/research-exec/runs/[runId]/route.test.ts' src/lib/auth/ownership.test.ts
git add 'src/app/api/research-exec/runs/[runId]/route.ts' 'src/app/api/research-exec/runs/[runId]/route.test.ts'
git commit -m "fix(auth): enforce experiment run ownership"
~~~

Expected: focused suites PASS and the commit succeeds.

### Task 4: Restrict skill listings by workspace and owner

**Files:**
- Create: src/app/api/skills/route.test.ts
- Modify: src/app/api/skills/route.ts

- [ ] **Step 1: Write failing workspace and owner-filter tests**

Mock requireAuth, requireWorkspaceAccess, ownedSkillFilter, and the Drizzle query chain:

~~~typescript
it("rejects listing another user's workspace skills", async () => {
  mocks.requireAuth.mockResolvedValue(userAuth);
  mocks.requireWorkspaceAccess.mockResolvedValue(
    NextResponse.json({ error: "Workspace access denied" }, { status: 403 }),
  );

  const response = await GET(new NextRequest(
    "http://localhost/api/skills?workspaceId=workspace-b",
  ));

  expect(response.status).toBe(403);
  expect(mocks.queryWhere).not.toHaveBeenCalled();
});

it("applies the owner filter to an ordinary user's global listing", async () => {
  mocks.requireAuth.mockResolvedValue(userAuth);
  mocks.ownedSkillFilter.mockReturnValue({ ownerFilter: true });

  const response = await GET(new NextRequest("http://localhost/api/skills"));

  expect(response.status).toBe(200);
  expect(mocks.ownedSkillFilter).toHaveBeenCalledWith(userAuth);
  expect(mocks.queryWhere).toHaveBeenCalledOnce();
});
~~~

- [ ] **Step 2: Run the test and verify RED**

Run:

~~~bash
npx vitest run src/app/api/skills/route.test.ts
~~~

Expected: FAIL because GET neither validates the workspace nor calls ownedSkillFilter.

- [ ] **Step 3: Combine scope and owner conditions**

After authentication and default-skill seeding, authorize an optional workspace. Build one scope expression and combine it with the owner filter:

~~~typescript
if (workspaceId) {
  const access = await requireWorkspaceAccess(request, workspaceId);
  if (access instanceof NextResponse) return access;
}

const scope = workspaceId
  ? or(isNull(skills.workspaceId), eq(skills.workspaceId, workspaceId))
  : isNull(skills.workspaceId);
const allSkills = await db
  .select()
  .from(skills)
  .where(and(scope, ownedSkillFilter(auth)))
  .orderBy(desc(skills.createdAt));
~~~

- [ ] **Step 4: Verify and commit**

Run:

~~~bash
npx vitest run src/app/api/skills/route.test.ts src/lib/auth/ownership.test.ts
git add src/app/api/skills/route.ts src/app/api/skills/route.test.ts
git commit -m "fix(auth): isolate skill listings by owner"
~~~

Expected: focused suites PASS and the commit succeeds.

### Task 5: Gate cluster status and unscoped operation history

**Files:**
- Create: src/app/api/cluster/status/route.test.ts
- Create: src/app/api/cluster/operations/route.test.ts
- Modify: src/app/api/cluster/status/route.ts
- Modify: src/app/api/cluster/operations/route.ts

- [ ] **Step 1: Write a failing cluster-status test**

~~~typescript
it("rejects an ordinary strict-mode user before loading cluster config", async () => {
  mocks.requireHighRiskExecution.mockResolvedValue(
    NextResponse.json(
      { error: "High-risk execution access required" },
      { status: 403 },
    ),
  );

  const response = await GET(
    new NextRequest("http://localhost/api/cluster/status?cluster=muxi"),
  );

  expect(response.status).toBe(403);
  expect(mocks.getK8sConfig).not.toHaveBeenCalled();
});
~~~

- [ ] **Step 2: Write failing unscoped-operation tests**

~~~typescript
it("rejects an ordinary user's all-workspace operation query", async () => {
  mocks.requireAuth.mockResolvedValue(userAuth);
  mocks.canUseHighRiskExecution.mockReturnValue(false);

  const response = await GET(
    new NextRequest("http://localhost/api/cluster/operations"),
  );

  expect(response.status).toBe(403);
  expect(mocks.listClusterOps).not.toHaveBeenCalled();
});

it("allows a privileged caller to query all operation history", async () => {
  mocks.requireAuth.mockResolvedValue(adminAuth);
  mocks.canUseHighRiskExecution.mockReturnValue(true);
  mocks.listClusterOps.mockResolvedValue([]);

  const response = await GET(
    new NextRequest("http://localhost/api/cluster/operations"),
  );

  expect(response.status).toBe(200);
  expect(mocks.listClusterOps).toHaveBeenCalledWith({
    workspaceId: undefined,
    limit: 50,
    offset: 0,
  });
});
~~~

- [ ] **Step 3: Run both route tests and verify RED**

Run:

~~~bash
npx vitest run src/app/api/cluster/status/route.test.ts src/app/api/cluster/operations/route.test.ts
~~~

Expected: ordinary-user tests FAIL because the current routes continue to configuration or database work.

- [ ] **Step 4: Add cluster guards**

At the start of cluster status:

~~~typescript
const access = await requireHighRiskExecution(request);
if (access instanceof NextResponse) return access;
~~~

At the start of cluster operations, explicitly authenticate. Preserve scoped workspace authorization and reject an unscoped query without high-risk access:

~~~typescript
const auth = await requireAuth(request);
if (auth instanceof NextResponse) return auth;

if (workspaceId) {
  const access = await requireWorkspaceAccess(request, workspaceId);
  if (access instanceof NextResponse) return access;
} else if (!canUseHighRiskExecution(auth)) {
  return forbiddenResponse("High-risk execution access required");
}
~~~

- [ ] **Step 5: Verify and commit**

Run:

~~~bash
npx vitest run src/app/api/cluster/status/route.test.ts src/app/api/cluster/operations/route.test.ts src/lib/auth/privileges.test.ts
git add src/app/api/cluster/status src/app/api/cluster/operations
git commit -m "fix(auth): gate cluster visibility"
~~~

Expected: focused suites PASS and the commit succeeds.

### Task 6: Add a failing standalone contamination gate

**Files:**
- Create: scripts/verify-standalone-artifact.mjs
- Modify: package.json

- [ ] **Step 1: Create the artifact verifier**

Create a Node script that recursively inspects a supplied root or .next/standalone. It must skip node_modules, allow only .env.example and .env.production.example, and reject these top-level directories:

~~~javascript
const forbiddenRoots = new Set([
  ".claude",
  ".git",
  ".superpowers",
  ".worktrees",
  "backups",
  "batch-test-logs",
  "data",
  "docs",
  "logs",
  "outputs",
  "reference",
  "src",
  "test-results",
  "tmp-playwright-review",
  "workspaces",
]);
~~~

It must also reject active .env files, SQLite files including WAL/SHM, and test/spec source outside node_modules. For a real Next.js artifact, it must require the compiled authentication proxy and its `/_middleware` function registration. It prints every violation and exits 1, or prints the verified root and exits 0.

- [ ] **Step 2: Build the unmodified app and verify RED**

Run:

~~~bash
NEXT_TELEMETRY_DISABLED=1 npx next build
node scripts/verify-standalone-artifact.mjs
~~~

Expected: Next build succeeds with whole-project trace warnings; the verifier exits 1 and lists src, docs, and data paths.

- [ ] **Step 3: Wire the verifier into the build lifecycle**

Add these package scripts:

~~~json
"postbuild": "npm run verify:standalone",
"verify:standalone": "node scripts/verify-standalone-artifact.mjs"
~~~

Do not run npm run build until Task 7 applies the trace fix.

- [ ] **Step 4: Commit the red gate**

Run:

~~~bash
git add scripts/verify-standalone-artifact.mjs package.json
git commit -m "test(build): reject contaminated standalone artifacts"
~~~

Expected: commit succeeds and the verifier remains red against the current artifact.

### Task 7: Use a clean production trace and restrict Docker inputs

**Files:**
- Modify: package.json
- Modify: next.config.ts
- Rename: middleware.ts to src/proxy.ts
- Modify: scripts/verify-standalone-artifact.mjs
- Modify: .dockerignore
- Modify: Dockerfile

- [x] **Step 1: Test tracing hypotheses**

Remove the configuration-time filesystem import and try targeted Turbopack
ignore annotations independently. Record that neither changes the
whole-project trace. Restore all experimental source edits.

- [x] **Step 2: Select the production tracer and exact exclusions**

Change `build` to `next build --webpack`. Add exact
`outputFileTracingExcludes` entries for `.claude`, `data`, the two redundant
dynamically imported TypeScript files, and the two translation JSON files whose
content is already bundled into server chunks.

- [x] **Step 3: Compile the Next.js 16 authentication proxy**

Move the legacy root `middleware.ts` to `src/proxy.ts` and rename the exported
function to `proxy`. Extend the artifact gate so a build fails without
`.next/server/middleware.js` or the `/_middleware` entry in
`functions-config-manifest.json`.

- [x] **Step 4: Expand .dockerignore**

Add:

~~~dockerignore
# Runtime state and deployment backups
backups/
logs/
outputs/
workspaces/

# Repository-local scratch and generated artifacts
.worktrees/
.superpowers/
.venv-docs/
reference/
batch-test-logs/
test-results/
tmp-playwright-review/
~~~

- [x] **Step 5: Replace COPY . . with an allowlist**

~~~dockerfile
COPY package.json package-lock.json ./
COPY next.config.ts tsconfig.json tsconfig.admin-cli.json ./
COPY postcss.config.mjs components.json drizzle.config.ts ./
COPY .env.example .env.production.example ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY drizzle ./drizzle
COPY config ./config
COPY plugins ./plugins
~~~

- [x] **Step 6: Run production build and verify GREEN**

Run:

~~~bash
rm -rf .next
NEXT_TELEMETRY_DISABLED=1 npm run build
node scripts/verify-standalone-artifact.mjs
~~~

Expected: exit 0 with no whole-project trace warning and no forbidden paths.

- [x] **Step 7: Build with ignored sentinel files present**

Run:

~~~bash
mkdir -p backups data logs outputs workspaces
printf 'SENTINEL_ONLY=true\n' > backups/security-packaging-sentinel.env.production.local
printf 'sentinel\n' > data/security-packaging-sentinel.db
printf 'sentinel\n' > logs/security-packaging-sentinel.log
printf 'sentinel\n' > outputs/security-packaging-sentinel.txt
printf 'sentinel\n' > workspaces/security-packaging-sentinel.txt
docker build -t innoclaw:security-packaging-test .
rm -f backups/security-packaging-sentinel.env.production.local \
  data/security-packaging-sentinel.db \
  logs/security-packaging-sentinel.log \
  outputs/security-packaging-sentinel.txt \
  workspaces/security-packaging-sentinel.txt
rmdir backups outputs workspaces 2>/dev/null || true
~~~

Expected: Docker build succeeds and ignored sentinels never enter any build stage.

- [x] **Step 8: Inspect image filesystem and authentication boundary**

Run:

~~~bash
docker run --rm --entrypoint sh innoclaw:security-packaging-test -c \
  'test ! -e /app/backups && test ! -e /app/src && test ! -e /app/docs && \
   test -z "$(find /app/data -type f -print -quit)"'
~~~

Expected: exit 0. The empty /app/data runtime directory is allowed.

Start a temporary container with local authentication enabled. Require `/` and
`/admin/users` to redirect to login, `/login` and `/register` to return 200,
and `/api/workspaces` to return 401 without a session.

- [x] **Step 9: Commit packaging fixes**

Run:

~~~bash
git add package.json next.config.ts scripts/verify-standalone-artifact.mjs .dockerignore Dockerfile
git commit -m "fix(build): prevent standalone artifact contamination"
~~~

Expected: commit succeeds.

### Task 8: Document the build-content gate

**Files:**
- Modify: AGENTS.md
- Modify: CONTRIBUTING.md
- Modify: docs/development/contributing.md
- Modify: docs/development/testing.md

- [ ] **Step 1: Add contributor guidance**

Add this rule to the validation sections:

~~~markdown
npm run build uses Webpack and automatically runs npm run verify:standalone
after Next.js finishes. The build fails if the standalone artifact is missing
the compiled authentication proxy or contains runtime data, credentials,
backups, repository source, tests, documentation, or local scratch content.
Keep new runtime paths outside the Docker build context and change the verifier
only when a shipped runtime asset is intentionally required.
~~~

- [ ] **Step 2: Refresh and build documentation**

Run:

~~~bash
cd docs
make update-po
make html
make html-zh
~~~

Expected: all commands exit 0. Do not stage docs/_build or compiled .mo files.

- [ ] **Step 3: Commit documentation**

Run:

~~~bash
git add AGENTS.md CONTRIBUTING.md docs/development/contributing.md docs/development/testing.md docs/locales
git commit -m "docs(build): document standalone artifact gate"
~~~

Expected: commit succeeds.

### Task 9: Complete verification and branch review

**Files:**
- Review every file changed from main

- [ ] **Step 1: Run authoritative validation**

Run:

~~~bash
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
npm run build:admin-cli
~~~

Expected: lint has zero errors, all tests pass, production build and artifact gate pass without whole-project trace warnings, and admin CLI compilation exits 0.

- [ ] **Step 2: Build and inspect a commit-tagged image**

Run:

~~~bash
tag="innoclaw:security-$(git rev-parse --short=8 HEAD)"
docker build -t "$tag" .
docker run --rm --entrypoint sh "$tag" -c \
  'test ! -e /app/backups && test ! -e /app/src && test ! -e /app/docs && \
   test -z "$(find /app/data -type f -print -quit)"'
~~~

Expected: both commands exit 0.

- [ ] **Step 3: Inspect branch scope**

Run:

~~~bash
git diff --check main...HEAD
git diff --stat main...HEAD
git log --oneline --decorate main..HEAD
git status --short --branch
~~~

Expected: only authorization, packaging, tests, and required docs changed; worktree is clean.

- [ ] **Step 4: Review**

Use superpowers:requesting-code-review. Because delegated agents cannot be configured to the required model, perform the review inline and fix any high- or medium-confidence defect with a failing regression test first.

### Task 10: Fast-forward main, push origin, and deploy the exact commit

**Systems:**
- Local main and origin/main
- Server /opt/innoclaw at ubuntu@106.75.210.30
- Docker Compose project innoclaw

- [ ] **Step 1: Refresh integration state**

From the main checkout run:

~~~bash
git fetch origin main
git status --short --branch
git rev-parse main origin/main
git merge-base --is-ancestor main fix/security-boundaries-packaging
~~~

Expected: main equals origin/main; only the user's pre-existing untracked outputs and workspaces are present; the branch descends from main.

- [ ] **Step 2: Fast-forward and push**

~~~bash
git merge --ff-only fix/security-boundaries-packaging
git push origin main
git rev-parse HEAD origin/main
~~~

Expected: the hashes are identical.

- [ ] **Step 3: Create and upload a clean release archive**

~~~bash
revision=$(git rev-parse HEAD)
short=$(git rev-parse --short=8 HEAD)
git archive --format=tar.gz --output="/tmp/innoclaw-$short.tar.gz" HEAD
printf '%s\n' "$revision" > "/tmp/innoclaw-$short.revision"
scp -P 22 "/tmp/innoclaw-$short.tar.gz" "/tmp/innoclaw-$short.revision" \
  ubuntu@106.75.210.30:/tmp/
ssh -p 22 ubuntu@106.75.210.30
~~~

Enter the supplied SSH password interactively; never store it in a command or file.

- [ ] **Step 4: Build the release in an isolated server directory**

On the server:

~~~bash
archive=$(ls -t /tmp/innoclaw-*.tar.gz | head -1)
short=$(basename "$archive" .tar.gz | sed 's/^innoclaw-//')
revision=$(cat "/tmp/innoclaw-$short.revision")
release="/opt/innoclaw/releases/$short"
sudo mkdir -p "$release"
sudo tar -xzf "$archive" -C "$release"
sudo docker build -t "innoclaw:security-$short" "$release"
~~~

Expected: build and standalone gate pass. The archive has no secrets or runtime state.

- [ ] **Step 5: Inspect before activation**

~~~bash
sudo docker run --rm --entrypoint sh "innoclaw:security-$short" -c \
  'test ! -e /app/backups && test ! -e /app/src && test ! -e /app/docs && \
   test -z "$(find /app/data -type f -print -quit)"'
~~~

Expected: exit 0.

- [ ] **Step 6: Preserve rollback metadata and activate**

~~~bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
current_image=$(sudo docker inspect innoclaw-innoclaw-1 --format '{{.Config.Image}}')
sudo docker tag "$current_image" "innoclaw:rollback-$stamp"
sudo cp /opt/innoclaw/docker-compose.yml \
  "/opt/innoclaw/backups/docker-compose-$stamp.yml"
sudo sed -i -E \
  "s|^[[:space:]]*image:.*|    image: innoclaw:security-$short|" \
  /opt/innoclaw/docker-compose.yml
printf '%s\n' "$revision" | sudo tee /opt/innoclaw/.deployed-revision >/dev/null
cd /opt/innoclaw
sudo docker compose -p innoclaw up -d --no-build
~~~

Expected: Compose reuses the environment file, data volume, and workspace bind.

- [ ] **Step 7: Verify container, HTTP, image content, and model**

Verify the container is running as nextjs with zero restarts and remains bound to 127.0.0.1:3000. Require root/admin redirects, register HTTP 200, and protected API HTTP 401 both locally and through http://106.75.210.30.

Run the redacted Node fetch inside the container with model gpt-5.6-sol and reasoning_effort xhigh. Require HTTP 200 without printing the API key.

- [ ] **Step 8: Remove the contaminated image**

After all production checks pass, remove every tag referencing known contaminated image ID 540569783b51. Preserve a rollback image that does not contain /app/backups. Re-run docker image ls --no-trunc and prove the contaminated ID is absent.

- [ ] **Step 9: Record final evidence and clean the feature worktree**

Locally verify main equals origin/main, remove the completed worktree, and delete the merged feature branch. Preserve the user's existing untracked outputs and workspaces directories.
