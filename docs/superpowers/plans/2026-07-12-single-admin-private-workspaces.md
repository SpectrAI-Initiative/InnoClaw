# Single-Administrator Authentication and Private Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public deployment's shared Basic Auth/no-auth application mode with one bootstrapped InnoClaw administrator, ordinary-user self-registration, and private per-user workspaces with administrator-wide visibility.

**Architecture:** Add opt-in auth policy and cookie configuration modules, enforce the single-admin invariant in every user mutation API, and ship a stdin-only bootstrap CLI in the production image. Derive ordinary-user roots below each configured `WORKSPACE_ROOTS` entry, canonicalize filesystem paths before authorization, split provisioning access from registered-workspace access, and gate command-execution capabilities that cannot be filesystem-sandboxed for ordinary users. Preserve disabled-auth and non-single-admin behavior unless the new policy is enabled.

**Tech Stack:** Next.js 16 App Router, TypeScript 6, Vitest 4, SQLite/better-sqlite3, Drizzle ORM, React 19, Docker Compose, Nginx.

---

## File Structure

### Authentication policy and bootstrap

- Create: `src/lib/auth/policy.ts`
  - Strict boolean parsing for `AUTH_SINGLE_ADMIN` and `AUTH_COOKIE_SECURE`.
- Create: `src/lib/auth/policy.test.ts`
  - Default, explicit, normalized, and invalid-value tests.
- Create: `src/lib/auth/admin-policy.ts`
  - Database-backed single-admin state inspection shared by auth routes.
- Create: `src/lib/auth/admin-policy.test.ts`
  - Ready, missing, inactive, and multiple-admin state tests.
- Modify: `src/lib/auth/server.ts`
  - Reuse one cookie-options helper for set, refresh, and clear operations.
- Modify: `src/lib/auth/server.test.ts`
  - HTTP/HTTPS cookie coverage.
- Create: `src/lib/auth/bootstrap-admin.ts`
  - Transactional, retry-safe administrator bootstrap against SQLite.
- Create: `src/lib/auth/bootstrap-admin.test.ts`
  - Creation, idempotence, inactive-admin, conflicting-admin, and ordinary-user collision tests.
- Create: `scripts/bootstrap-admin.ts`
  - Parse operator arguments and read the password only from stdin.
- Create: `tsconfig.admin-cli.json`
  - Compile the CLI and its dependency graph for the production image.
- Modify: `package.json`, `Dockerfile`
  - Build and copy the CLI into the runner image.

### Account APIs and UI

- Modify: `src/app/api/auth/register/route.ts`
  - Fixed ordinary-user registration and fail-closed bootstrap-state checks.
- Modify: `src/app/api/auth/register/route.test.ts`
  - Strict-mode registration contract tests.
- Modify: `src/app/api/admin/users/route.ts`
  - Single-admin mutation guards and policy-state validation.
- Modify: `src/app/api/admin/users/route.test.ts`
  - Allow/deny matrix for creation, role change, disable, delete, and reset.
- Modify: `src/app/admin/users/user-management-client.tsx`
  - Hide role mutation when the API reports single-admin mode.
- Create: `src/app/admin/users/user-management-client.test.tsx`
  - Server-rendered role-control and immutable-admin tests.

### Filesystem and workspace isolation

- Create: `src/lib/files/canonical-path.ts`
  - Canonical existing/prospective path resolution and root containment.
- Create: `src/lib/files/canonical-path.test.ts`
  - Traversal, platform case, missing leaf, and symlink-escape tests.
- Modify: `src/lib/files/filesystem.ts`, `src/lib/files/filesystem.test.ts`
  - Apply canonical root validation to all filesystem operations.
- Create: `src/lib/auth/workspace-roots.ts`
  - Derive and provision role-aware effective workspace roots.
- Create: `src/lib/auth/workspace-roots.test.ts`
  - Ordinary-user isolation, administrator roots, disabled auth, and unsafe ID tests.
- Modify: `src/lib/auth/ownership.ts`, `src/lib/auth/ownership.test.ts`
  - Administrator-global filters plus separate provisioning and registered-workspace checks.
- Modify: `src/app/api/settings/route.ts`
  - Return a safe authenticated settings subset with role-aware roots; retain admin-only privileged fields and PATCH.
- Create: `src/app/api/settings/route.test.ts`
  - Ordinary-user redaction and admin response tests.
- Modify: `src/app/page.tsx`, `src/components/paper-study/directory-picker-dialog.tsx`
  - Consume the role-aware roots/default path returned by settings.

### Workspace registration and alternate path entry points

- Modify: `src/lib/db/schema.ts`
  - Add canonical workspace-path uniqueness.
- Create: `src/lib/db/workspace-path-preflight.ts`
  - Canonicalize legacy rows or report colliding IDs before the unique migration.
- Create: `src/lib/db/workspace-path-preflight.test.ts`
  - Rewrite, collision, and no-op tests.
- Create: `drizzle/0017_workspace_folder_path_unique.sql`
  - Create the unique index after preflight.
- Modify: `drizzle/meta/_journal.json`
  - Register migration 0017.
- Modify: `src/lib/db/migrate.ts`
  - Run preflight once before the unique index is applied.
- Modify: `src/app/api/workspaces/route.ts`, `src/app/api/workspaces/route.test.ts`
  - Authorize/canonicalize before mutation; map uniqueness races to 409.
- Modify: `src/app/api/files/browse/route.ts`, `src/app/api/files/mkdir/route.ts`
  - Use provisioning access so a user can create a first workspace.
- Create: `src/app/api/files/browse/route.test.ts`, `src/app/api/files/mkdir/route.test.ts`
  - First-workspace and cross-user denial tests.
- Modify: `src/app/api/git/clone/route.ts`
  - Clone into the caller's effective root and assign ownership.
- Create: `src/app/api/git/clone/route.test.ts`
  - Root selection, traversal, owner, and collision tests.
- Modify path-taking paper-study routes under `src/app/api/paper-study/`
  - Require provisioning or registered-workspace access before filesystem calls.
- Add focused co-located route tests for every changed paper-study route.

### Tool and command privilege boundaries

- Create: `src/lib/auth/privileges.ts`, `src/lib/auth/privileges.test.ts`
  - Decide whether high-risk local/cluster execution is permitted.
- Modify: `src/lib/ai/tools/types.ts`, `src/lib/ai/tools/index.ts`
  - Anchor file tools to the selected workspace and omit shell/K8s/research-exec tools for ordinary users in single-admin mode.
- Create: `src/lib/ai/tools/index.test.ts`
  - Tool allow/deny and absolute-path escape tests.
- Modify: `src/app/api/agent/route.ts`
  - Pass authenticated privilege context into tool construction.
- Modify: `src/app/api/terminal/exec/route.ts`
  - Reject ordinary users in single-admin mode.
- Create or modify: `src/app/api/terminal/exec/route.test.ts`
  - Administrator allow and ordinary-user deny tests.

### Documentation and deployment

- Modify: `.env.example`, `.env.production.example`
  - Document `AUTH_SINGLE_ADMIN` and `AUTH_COOKIE_SECURE`.
- Modify: `docs/getting-started/environment-variables.md`, `docs/docker.md`, `docs/getting-started/deployment.md`
  - Document bootstrap, HTTP risk, private roots, backup, and HTTPS transition.
- Refresh: `docs/locales/zh_CN/LC_MESSAGES/*.po`
  - Update translation catalogs after English documentation changes.

---

### Task 1: Add Strict Auth Policy and Cookie Configuration

**Files:**
- Create: `src/lib/auth/policy.ts`
- Create: `src/lib/auth/policy.test.ts`
- Modify: `src/lib/auth/server.ts`
- Modify: `src/lib/auth/server.test.ts`

- [ ] **Step 1: Write failing policy tests**

Create `src/lib/auth/policy.test.ts` with the complete matrix:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { isSingleAdminMode, shouldUseSecureAuthCookies } from "./policy";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("auth policy environment", () => {
  it("keeps single-admin mode off by default", () => {
    delete process.env.AUTH_SINGLE_ADMIN;
    expect(isSingleAdminMode()).toBe(false);
  });

  it.each([["true", true], [" TRUE ", true], ["false", false], [" False ", false]])(
    "parses AUTH_SINGLE_ADMIN=%s",
    (raw, expected) => {
      process.env.AUTH_SINGLE_ADMIN = raw;
      expect(isSingleAdminMode()).toBe(expected);
    },
  );

  it("rejects an invalid single-admin value", () => {
    process.env.AUTH_SINGLE_ADMIN = "yes";
    expect(() => isSingleAdminMode()).toThrow(/AUTH_SINGLE_ADMIN.*true.*false/);
  });

  it("defaults production cookies to secure", () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_SECURE;
    expect(shouldUseSecureAuthCookies()).toBe(true);
  });

  it("allows the explicit temporary HTTP override", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_COOKIE_SECURE = "false";
    expect(shouldUseSecureAuthCookies()).toBe(false);
  });

  it("rejects an invalid cookie value", () => {
    process.env.AUTH_COOKIE_SECURE = "0";
    expect(() => shouldUseSecureAuthCookies()).toThrow(/AUTH_COOKIE_SECURE.*true.*false/);
  });
});
```

- [ ] **Step 2: Run the policy tests and observe the missing-module failure**

Run: `npx vitest run src/lib/auth/policy.test.ts`

Expected: FAIL because `src/lib/auth/policy.ts` does not exist.

- [ ] **Step 3: Implement strict boolean parsing**

Create `src/lib/auth/policy.ts`:

```typescript
function optionalBoolean(name: string, raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${name} must be either true or false`);
}

export function isSingleAdminMode(): boolean {
  return optionalBoolean("AUTH_SINGLE_ADMIN", process.env.AUTH_SINGLE_ADMIN) ?? false;
}

export function shouldUseSecureAuthCookies(): boolean {
  return optionalBoolean("AUTH_COOKIE_SECURE", process.env.AUTH_COOKIE_SECURE)
    ?? process.env.NODE_ENV === "production";
}
```

- [ ] **Step 4: Add failing cookie assertions to `src/lib/auth/server.test.ts`**

Test `attachAuthCookies` and `clearAuthCookies` under production with `AUTH_COOKIE_SECURE=false` and `true`. For each of `innoclaw_session`, `innoclaw_session_expires`, and `innoclaw_session_signature`, assert the serialized `Set-Cookie` header omits or contains `Secure` as configured.

- [ ] **Step 5: Centralize cookie options in `src/lib/auth/server.ts`**

Import `shouldUseSecureAuthCookies` and replace every direct `process.env.NODE_ENV === "production"` cookie option with one helper:

```typescript
function authCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureAuthCookies(),
    path: "/",
    expires,
  };
}
```

Use it from `setCookiePair` and all three branches in `clearAuthCookies`.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/lib/auth/policy.test.ts src/lib/auth/server.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/policy.ts src/lib/auth/policy.test.ts src/lib/auth/server.ts src/lib/auth/server.test.ts
git commit -m "feat(auth): add single-admin and cookie policy"
```

---

### Task 2: Inspect and Enforce the Single-Administrator State

**Files:**
- Create: `src/lib/auth/admin-policy.ts`
- Create: `src/lib/auth/admin-policy.test.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/auth/register/route.test.ts`

- [ ] **Step 1: Write failing administrator-state tests**

Mock the Drizzle query in `src/lib/auth/admin-policy.test.ts` and assert these exact results:

```typescript
expect(classifyAdministrators([])).toEqual({ status: "invalid", reason: "missing" });
expect(classifyAdministrators([{ id: "a", isActive: true }])).toEqual({ status: "ready", adminId: "a" });
expect(classifyAdministrators([{ id: "a", isActive: false }])).toEqual({ status: "invalid", reason: "inactive" });
expect(classifyAdministrators([{ id: "a", isActive: true }, { id: "b", isActive: true }]))
  .toEqual({ status: "invalid", reason: "multiple" });
```

Also assert `getSingleAdminState()` returns `{ status: "disabled" }` without querying the database when `AUTH_SINGLE_ADMIN=false`.

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx vitest run src/lib/auth/admin-policy.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement `src/lib/auth/admin-policy.ts`**

Define the stable contract and query only administrator rows:

```typescript
export type SingleAdminState =
  | { status: "disabled" }
  | { status: "ready"; adminId: string }
  | { status: "invalid"; reason: "missing" | "inactive" | "multiple" };

export function classifyAdministrators(rows: Array<{ id: string; isActive: boolean }>): SingleAdminState {
  if (rows.length === 0) return { status: "invalid", reason: "missing" };
  if (rows.length > 1) return { status: "invalid", reason: "multiple" };
  if (!rows[0].isActive) return { status: "invalid", reason: "inactive" };
  return { status: "ready", adminId: rows[0].id };
}

export async function getSingleAdminState(): Promise<SingleAdminState> {
  if (!isSingleAdminMode()) return { status: "disabled" };
  const rows = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.role, "admin"));
  return classifyAdministrators(rows);
}
```

- [ ] **Step 4: Write failing strict-registration route tests**

Extend `src/app/api/auth/register/route.test.ts` with four concrete fixtures: mock `getSingleAdminState` as missing and assert 503 with no insert; submit `role: "admin"` and assert 400 with no insert; mock a ready administrator plus `getUserCount=1` and assert the `createUser` call contains `role: "user"`; disable the policy plus `getUserCount=0` and assert the existing first-user path still passes `role: "admin"`.

Assert the strict-mode call to `createUser` contains `role: "user"` and never calls `claimExistingDataForFirstUser`.

- [ ] **Step 5: Implement the registration guard**

In `src/app/api/auth/register/route.ts`:

```typescript
const strict = isSingleAdminMode();
if (strict && Object.prototype.hasOwnProperty.call(body, "role")) {
  return jsonError("Role cannot be selected during registration", 400);
}
if (strict) {
  const state = await getSingleAdminState();
  if (state.status !== "ready") {
    return jsonError("Administrator setup is incomplete", 503);
  }
}

const role = strict ? "user" : userCount === 0 ? "admin" : "user";
```

Retain the existing first-user claim only for non-strict mode.

- [ ] **Step 6: Run focused tests**

Run: `npx vitest run src/lib/auth/admin-policy.test.ts src/app/api/auth/register/route.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/admin-policy.ts src/lib/auth/admin-policy.test.ts src/app/api/auth/register/route.ts src/app/api/auth/register/route.test.ts
git commit -m "feat(auth): enforce ordinary public registration"
```

---

### Task 3: Enforce the User-Management Mutation Matrix

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/admin/users/route.test.ts`
- Modify: `src/app/admin/users/user-management-client.tsx`
- Create: `src/app/admin/users/user-management-client.test.tsx`

- [ ] **Step 1: Write failing API tests**

Add strict-mode tests that authenticate as the ready administrator and assert:

```typescript
POST { email, password }                     // 201, stored role=user
POST { email, password, role: "admin" }      // 400
PATCH { userId: ordinary, role: "admin" }    // 400
PATCH { userId: admin, isActive: false }      // 400
PATCH { userId: ordinary, isActive: false }   // 200, sessions revoked
PATCH { userId: ordinary, password: "new-password-123" }  // 200, sessions revoked
DELETE { userId: admin }                      // 400
DELETE { userId: ordinary }                   // 200, ownership transferred
```

Also assert every privileged mutation returns 503 when `getSingleAdminState()` is not ready, and retain current multi-admin tests with `AUTH_SINGLE_ADMIN=false`.

- [ ] **Step 2: Run the route tests and observe failures**

Run: `npx vitest run src/app/api/admin/users/route.test.ts`

Expected: FAIL on strict-mode cases.

- [ ] **Step 3: Implement server-side guards**

Add one route-local helper after `requireAdmin`:

```typescript
async function requireReadyAdmin(actorId: string): Promise<NextResponse | null> {
  if (!isSingleAdminMode()) return null;
  const state = await getSingleAdminState();
  if (state.status !== "ready" || state.adminId !== actorId) {
    return jsonError("Single-administrator policy is not ready", 503);
  }
  return null;
}
```

In strict mode, POST always writes `role: "user"` and rejects any supplied role other than `user`; PATCH rejects every supplied `role`, and rejects `isActive=false` for the administrator; DELETE rejects the administrator. Return `{ users, singleAdmin: isSingleAdminMode() }` from GET.

- [ ] **Step 4: Write the failing client test**

Mock SWR with `{ singleAdmin: true, users: [admin, user] }`, render `UserManagementClient`, and assert:

```typescript
expect(html).not.toContain("Role</label>");
expect(html).not.toContain("SelectItem value=\"admin\"");
expect(html).toContain("Admin");
expect(html).toContain("User");
```

Add a non-strict fixture and assert role controls remain available.

- [ ] **Step 5: Update the client**

Change the SWR response type to `{ users: PublicUser[]; singleAdmin: boolean }`. In strict mode omit the create-role select, send no `role` field, render a badge instead of a role select, and disable the sole administrator's active/delete controls.

- [ ] **Step 6: Run API and UI tests**

Run: `npx vitest run src/app/api/admin/users/route.test.ts src/app/admin/users/user-management-client.test.tsx src/app/admin/users/page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/users/route.ts src/app/api/admin/users/route.test.ts src/app/admin/users/user-management-client.tsx src/app/admin/users/user-management-client.test.tsx
git commit -m "feat(auth): lock single-admin user management"
```

---

### Task 4: Build the Stdin-Only Administrator Bootstrap CLI

**Files:**
- Create: `src/lib/auth/bootstrap-admin.ts`
- Create: `src/lib/auth/bootstrap-admin.test.ts`
- Create: `scripts/bootstrap-admin.ts`
- Create: `tsconfig.admin-cli.json`
- Modify: `package.json`
- Modify: `Dockerfile`

- [ ] **Step 1: Write failing bootstrap-domain tests**

Create an in-memory better-sqlite3 database with the production `users` columns and test this public API:

```typescript
const result = bootstrapAdministrator(sqlite, {
  email: "admin@innoclaw.local",
  name: "Administrator",
  password: "a-long-test-password",
});
expect(result).toMatchObject({ status: "created", email: "admin@innoclaw.local" });
```

Cover six concrete database states: an empty table creates one active admin whose hash passes `verifyPassword`; calling again with the same email returns `existing` and leaves the hash unchanged; the same inactive admin throws; a different admin throws; an ordinary row with the requested email throws; and a seven-character password throws before an insert.

- [ ] **Step 2: Run the domain tests and verify failure**

Run: `npx vitest run src/lib/auth/bootstrap-admin.test.ts`

Expected: FAIL because `bootstrap-admin.ts` is missing.

- [ ] **Step 3: Implement transactional bootstrap logic**

Create `src/lib/auth/bootstrap-admin.ts` with this stable interface:

```typescript
import crypto from "crypto";
import type Database from "better-sqlite3";
import { hashPassword } from "./password";

export interface BootstrapAdminInput {
  email: string;
  name: string;
  password: string;
}

export type BootstrapAdminResult =
  | { status: "created"; email: string }
  | { status: "existing"; email: string };

export function bootstrapAdministrator(
  sqlite: Database.Database,
  input: BootstrapAdminInput,
): BootstrapAdminResult {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || "Administrator";
  if (!email || !email.includes("@")) throw new Error("A valid administrator email is required");
  if (input.password.length < 8) throw new Error("Administrator password must be at least 8 characters");

  return sqlite.transaction(() => {
    const admins = sqlite.prepare(
      "SELECT id, email, is_active AS isActive FROM users WHERE role = 'admin'",
    ).all() as Array<{ id: string; email: string; isActive: number }>;
    if (admins.length > 1) throw new Error("Multiple administrators already exist");
    if (admins.length === 1) {
      const admin = admins[0];
      if (admin.email !== email) throw new Error("A different administrator already exists");
      if (!admin.isActive) throw new Error("The existing administrator is inactive");
      return { status: "existing", email };
    }

    const collision = sqlite.prepare("SELECT role FROM users WHERE email = ?").get(email);
    if (collision) throw new Error("The administrator email already belongs to an ordinary user");

    const now = new Date().toISOString();
    sqlite.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 1, ?, ?)
    `).run(crypto.randomUUID(), email, name, hashPassword(input.password), now, now);
    return { status: "created", email };
  })();
}
```

- [ ] **Step 4: Run bootstrap-domain tests**

Run: `npx vitest run src/lib/auth/bootstrap-admin.test.ts`

Expected: PASS.

- [ ] **Step 5: Implement the CLI entry point**

Create `scripts/bootstrap-admin.ts`. Support only `--email` and `--name`; read all password bytes from stdin, remove one trailing line ending, and reject a TTY or empty stdin. Resolve `DATABASE_URL` using the same leading `file:` stripping and default `/app/data/innoclaw.db` behavior as `src/lib/db/index.ts`. Print only one of:

```text
Administrator created: admin@innoclaw.local
Administrator already exists: admin@innoclaw.local
```

Never print the password, hash, database contents, or environment.

- [ ] **Step 6: Compile the CLI for production**

Create `tsconfig.admin-cli.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": ".admin-cli",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": [
    "scripts/bootstrap-admin.ts",
    "src/lib/auth/bootstrap-admin.ts",
    "src/lib/auth/password.ts"
  ]
}
```

Add scripts:

```json
"build:admin-cli": "tsc -p tsconfig.admin-cli.json",
"auth:bootstrap-admin": "node .admin-cli/scripts/bootstrap-admin.js"
```

Run `npm run build:admin-cli`, then pipe a test password into the CLI against a temporary migrated database. Expected: exit 0 and no password in stdout/stderr.

- [ ] **Step 7: Package the CLI in Docker**

In the builder stage run `npm run build:admin-cli`. In the runner stage add:

```dockerfile
COPY --from=builder /app/.admin-cli ./admin-cli
```

The production invocation becomes:

```bash
printf '%s\n' "$ADMIN_PASSWORD" | docker compose exec -T innoclaw \
  node /app/admin-cli/scripts/bootstrap-admin.js \
  --email admin@innoclaw.local --name Administrator
```

- [ ] **Step 8: Verify and commit**

Run:

```bash
npx vitest run src/lib/auth/bootstrap-admin.test.ts
npm run build:admin-cli
docker build -t innoclaw:bootstrap-cli-test .
```

Expected: all commands succeed.

Commit:

```bash
git add src/lib/auth/bootstrap-admin.ts src/lib/auth/bootstrap-admin.test.ts scripts/bootstrap-admin.ts tsconfig.admin-cli.json package.json Dockerfile
git commit -m "feat(auth): add administrator bootstrap cli"
```

---

### Task 5: Add Canonical Path Resolution and Symlink Containment

**Files:**
- Create: `src/lib/files/canonical-path.ts`
- Create: `src/lib/files/canonical-path.test.ts`
- Modify: `src/lib/files/filesystem.ts`
- Modify: `src/lib/files/filesystem.test.ts`

- [ ] **Step 1: Write real-filesystem failing tests**

Use `fs.mkdtempSync`, create sibling `user-a` and `user-b` directories, and create a symlink `user-a/escape -> user-b`. Assert:

```typescript
expect(resolvePathWithinRoots(path.join(userA, "notes.md"), [userA])).toBe(path.join(userA, "notes.md"));
expect(() => resolvePathWithinRoots(path.join(userA, "..", "user-b"), [userA])).toThrow(PathAccessError);
expect(() => resolvePathWithinRoots(path.join(userA, "escape", "secret.md"), [userA])).toThrow(PathAccessError);
expect(() => resolvePathWithinRoots("relative/path", [userA])).toThrow(/absolute/);
```

Also assert Linux comparisons remain case-sensitive and Windows comparisons are case-insensitive by passing an explicit platform argument to the pure comparison helper.

- [ ] **Step 2: Run tests and verify missing-module failure**

Run: `npx vitest run src/lib/files/canonical-path.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement canonical path utilities**

Create `src/lib/files/canonical-path.ts` with:

```typescript
export class PathAccessError extends Error {}

export function isPathWithinRoot(
  target: string,
  root: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const normalize = (value: string) => platform === "win32" ? value.toLowerCase() : value;
  const relative = path.relative(normalize(root), normalize(target));
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function canonicalizePath(target: string): string {
  if (!path.isAbsolute(target)) throw new PathAccessError("Path must be absolute");
  if (target.includes("\0")) throw new PathAccessError("Path contains a null byte");
  let cursor = path.resolve(target);
  const missing: string[] = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new PathAccessError("No existing path ancestor");
    missing.unshift(path.basename(cursor));
    cursor = parent;
  }
  return path.resolve(fs.realpathSync(cursor), ...missing);
}

export function resolvePathWithinRoots(target: string, roots: string[]): string {
  if (roots.length === 0) throw new PathAccessError("No workspace roots configured");
  const canonical = canonicalizePath(target);
  const allowed = roots.map(canonicalizePath).some((root) => isPathWithinRoot(canonical, root));
  if (!allowed) throw new PathAccessError("Path is outside the allowed roots");
  return canonical;
}
```

- [ ] **Step 4: Route filesystem validation through the canonical helper**

In `src/lib/files/filesystem.ts`, make `validatePath` return `resolvePathWithinRoots(targetPath, getWorkspaceRoots())` when roots exist. Preserve the current no-root behavior only for disabled-auth compatibility. Make `isWithinWorkspace` compare canonical paths so a symlink cannot make an owned workspace cover a sibling directory.

- [ ] **Step 5: Run path tests**

Run: `npx vitest run src/lib/files/canonical-path.test.ts src/lib/files/filesystem.test.ts`

Expected: PASS on the host platform. If symlink creation is unavailable on Windows, the symlink test must skip only for the platform permission error, not for assertion failures.

- [ ] **Step 6: Commit**

```bash
git add src/lib/files/canonical-path.ts src/lib/files/canonical-path.test.ts src/lib/files/filesystem.ts src/lib/files/filesystem.test.ts
git commit -m "fix(files): reject canonical path escapes"
```

---

### Task 6: Derive Per-User Roots and Administrator-Global Ownership

**Files:**
- Create: `src/lib/auth/workspace-roots.ts`
- Create: `src/lib/auth/workspace-roots.test.ts`
- Modify: `src/lib/auth/ownership.ts`
- Modify: `src/lib/auth/ownership.test.ts`

- [ ] **Step 1: Write failing effective-root tests**

Given roots `[/research, /projects]`, assert:

```typescript
expect(getEffectiveWorkspaceRoots(userAuth, roots)).toEqual([
  "/research/users/user-a",
  "/projects/users/user-a",
]);
expect(getEffectiveWorkspaceRoots(adminAuth, roots)).toEqual(roots);
expect(getEffectiveWorkspaceRoots(ANONYMOUS_AUTH_CONTEXT, roots)).toEqual(roots);
expect(() => getEffectiveWorkspaceRoots(authWithId("../escape"), roots)).toThrow(/user id/);
```

Use temporary directories to verify `ensureEffectiveWorkspaceRoots` creates only the ordinary user's derived directory with mode no broader than `0700` on POSIX.

- [ ] **Step 2: Implement `workspace-roots.ts`**

Export:

```typescript
export function getEffectiveWorkspaceRoots(auth: AuthContext, configured = getWorkspaceRoots()): string[];
export function ensureEffectiveWorkspaceRoots(auth: AuthContext, configured = getWorkspaceRoots()): string[];
export function resolveProvisioningPath(auth: AuthContext, target: string): string;
```

Ordinary users append `users/` and their immutable database user ID to every configured root. Administrators and disabled auth receive configured roots. `ensureEffectiveWorkspaceRoots` rejects missing configured roots, creates only derived ordinary-user roots, then returns canonical paths.

- [ ] **Step 3: Write failing ownership tests**

Add query assertions:

```typescript
expect(ownedWorkspaceFilter(adminAuth)).toBeUndefined();
expect(ownedDatasetFilter(adminAuth)).toBeUndefined();
expect(canAccessOwner(adminAuth, "user-b")).toBe(true);
expect(sqlFor(ownedWorkspaceFilter(userAuth)).params).toContain("user-a");
```

Add mocked database tests proving `requireWorkspacePathsAccess` lets the administrator access user B's registered workspace but rejects user A.

- [ ] **Step 4: Implement administrator-global filters and provisioning access**

In `ownership.ts`, return `undefined` from owner filters for disabled auth or an administrator. Add:

```typescript
export async function requireWorkspaceProvisioningPathsAccess(
  request: NextRequest,
  targetPaths: string[],
): Promise<{ auth: AuthContext; canonicalPaths: string[] } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return {
      auth,
      canonicalPaths: targetPaths.map((target) => resolveProvisioningPath(auth, target)),
    };
  } catch {
    return forbiddenResponse("Path access denied");
  }
}
```

Keep `requireWorkspacePathsAccess` for already registered workspaces and canonicalize every target before comparing it with visible workspace rows.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npx vitest run src/lib/auth/workspace-roots.test.ts src/lib/auth/ownership.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/lib/auth/workspace-roots.ts src/lib/auth/workspace-roots.test.ts src/lib/auth/ownership.ts src/lib/auth/ownership.test.ts
git commit -m "feat(workspace): isolate effective user roots"
```

---

### Task 7: Return Safe Role-Aware Settings to Ordinary Users

**Files:**
- Modify: `src/app/api/settings/route.ts`
- Create: `src/app/api/settings/route.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/paper-study/directory-picker-dialog.tsx`

- [ ] **Step 1: Write failing settings response tests**

Mock `requireAuth`, effective roots, settings rows, and provider configuration. For an ordinary user assert status 200 and exactly the safe contract:

```typescript
expect(body).toMatchObject({
  llmProvider: "openai",
  llmModel: "gpt-5.6-sol",
  contextMode: "normal",
  maxMode: true,
  workspaceRoots: ["/research/users/user-a"],
  defaultBrowsePath: "/research/users/user-a",
  hasAIKey: true,
  configuredProviders: ["openai"],
});
expect(body).not.toHaveProperty("providerBaseUrls");
expect(body).not.toHaveProperty("k8sConfig");
expect(body).not.toHaveProperty("hasGithubToken");
```

For an administrator assert the existing privileged fields remain present and `workspaceRoots` contains `/research`. Assert PATCH still returns 403 for the ordinary user.

- [ ] **Step 2: Run the tests and verify failure**

Run: `npx vitest run src/app/api/settings/route.test.ts`

Expected: FAIL because GET currently requires an administrator.

- [ ] **Step 3: Split safe and privileged response construction**

Change GET to call `requireAuth`. Build the common response once, using:

```typescript
const workspaceRoots = ensureEffectiveWorkspaceRoots(auth);
const common = {
  llmProvider,
  llmModel,
  contextMode: settingsMap.context_mode || "normal",
  maxMode: settingsMap.max_mode !== "false",
  workspaceRoots,
  defaultBrowsePath: workspaceRoots[0] || "",
  hasAIKey: Object.values(providerKeys).some(Boolean),
  configuredProviders: Object.entries(providerKeys)
    .filter(([, configured]) => configured)
    .map(([id]) => id),
};
```

Return `common` immediately for a non-admin. Only an administrator receives provider base URLs, token-source booleans, bot flags, GitHub state, and K8s configuration. Keep PATCH on `requireAdmin`.

- [ ] **Step 4: Make clients fail visibly and use the returned default**

In `src/app/page.tsx` and the paper-study directory picker, check `res.ok` before decoding and use `workspaceRoots[0]` when `defaultBrowsePath` is blank. Do not restore the Desktop fallback.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npx vitest run src/app/api/settings/route.test.ts
npx tsc --noEmit
```

Expected: PASS.

Commit:

```bash
git add src/app/api/settings/route.ts src/app/api/settings/route.test.ts src/app/page.tsx src/components/paper-study/directory-picker-dialog.tsx
git commit -m "fix(settings): expose safe user workspace roots"
```

---

### Task 8: Canonicalize Existing Workspace Rows and Add Uniqueness

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/workspace-path-preflight.ts`
- Create: `src/lib/db/workspace-path-preflight.test.ts`
- Create: `drizzle/0017_workspace_folder_path_unique.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/lib/db/migrate.ts`

- [ ] **Step 1: Write failing preflight tests**

Use in-memory SQLite and a minimal `workspaces(id, folder_path)` table. Assert:

```typescript
expect(preflightWorkspacePaths(sqlite)).toEqual({ rewritten: 1 });
expect(row.folder_path).toBe(canonicalizePath(nonCanonicalPath));
expect(() => preflightWorkspacePaths(databaseWithCanonicalCollision))
  .toThrow(/workspace-a.*workspace-b/);
```

Also assert no rows are modified when a collision exists and preflight is a no-op when the table or target index does not require work.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run src/lib/db/workspace-path-preflight.test.ts`

Expected: FAIL because the preflight module is missing.

- [ ] **Step 3: Implement transactional preflight**

Create `preflightWorkspacePaths(sqlite)` that:

1. checks `sqlite_master` for the `workspaces` table and `workspaces_folder_path_unique_idx`;
2. reads `id, folder_path` when the table exists and the index does not;
3. canonicalizes every path before opening a write transaction;
4. builds a map from canonical path to workspace IDs and throws with every colliding ID;
5. updates changed rows in one SQLite transaction;
6. returns `{ rewritten: number }`.

- [ ] **Step 4: Add the schema index and migration**

In `schema.ts` add:

```typescript
uniqueIndex("workspaces_folder_path_unique_idx").on(table.folderPath)
```

Create `drizzle/0017_workspace_folder_path_unique.sql`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_folder_path_unique_idx
ON workspaces(folder_path);
```

Append journal entry index 18, version 6, tag `0017_workspace_folder_path_unique`, with a timestamp greater than the 0016 entry.

- [ ] **Step 5: Run preflight before migration 0017**

In `src/lib/db/migrate.ts`, call `preflightWorkspacePaths(sqlite)` at the beginning of `runMigrationsOnce`. It must run before `readMigrationFiles` executes the unique-index statement and must propagate collision errors without the existing-table journal fallback.

- [ ] **Step 6: Verify migration behavior**

Run:

```bash
npx vitest run src/lib/db/workspace-path-preflight.test.ts
rm -f /tmp/innoclaw-workspace-index-test.db
DATABASE_URL=/tmp/innoclaw-workspace-index-test.db npx drizzle-kit migrate
```

Then insert the same `folder_path` twice using `sqlite3` or a short `node -e` better-sqlite3 command. Expected: the second insert fails with `SQLITE_CONSTRAINT_UNIQUE`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/workspace-path-preflight.ts src/lib/db/workspace-path-preflight.test.ts src/lib/db/migrate.ts drizzle/0017_workspace_folder_path_unique.sql drizzle/meta/_journal.json
git commit -m "feat(db): enforce unique canonical workspace paths"
```

---

### Task 9: Fix First-Workspace Creation and Alternate Registration Paths

**Files:**
- Modify: `src/app/api/workspaces/route.ts`
- Modify: `src/app/api/workspaces/route.test.ts`
- Modify: `src/app/api/files/browse/route.ts`
- Modify: `src/app/api/files/mkdir/route.ts`
- Create: `src/app/api/files/browse/route.test.ts`
- Create: `src/app/api/files/mkdir/route.test.ts`
- Modify: `src/app/api/git/clone/route.ts`
- Create: `src/app/api/git/clone/route.test.ts`

- [ ] **Step 1: Write failing first-workspace and isolation tests**

Extend workspace route tests with five explicit fixtures: provisioning access returns user A plus an empty existing-row query and the insert succeeds with 201; provisioning access returns a 403 response for user B's root and no database call occurs; provisioning access returns a path containing a resolved symlink target and the inserted row uses that canonical value plus `ownerUserId="user-a"`; `insert().values()` rejects with `SQLITE_CONSTRAINT_UNIQUE` and the route returns 409; and an administrator fixture under `/research` succeeds.

Browse/mkdir route tests must prove they call `requireWorkspaceProvisioningPathsAccess`, accept user A's effective root without a workspace row, and reject user B's root.

- [ ] **Step 2: Run route tests and verify failures**

Run:

```bash
npx vitest run src/app/api/workspaces/route.test.ts src/app/api/files/browse/route.test.ts src/app/api/files/mkdir/route.test.ts
```

Expected: FAIL because the current routes require registered-workspace access.

- [ ] **Step 3: Authorize before filesystem or database mutation**

In workspace POST, call:

```typescript
const access = await requireWorkspaceProvisioningPathsAccess(request, [folderPath]);
if (access instanceof NextResponse) return access;
const canonicalFolderPath = access.canonicalPaths[0];
const ownerUserId = getOwnerUserIdForWrite(access.auth);
```

Use only `canonicalFolderPath` for existence checks, conflict queries, and inserts. Remove the unconditional `addWorkspaceRoot(folderPath)`. Convert unique-index errors to `jsonError("This folder is already registered", 409)`.

Use provisioning access in browse and mkdir, pass the returned canonical path to `listDirectory`/`createDirectory`, and remove browse's dynamic root mutation.

- [ ] **Step 4: Write failing Git clone tests**

Assert an ordinary user's clone target is `/research/users/user-a/sample-repo`, its inserted row has `ownerUserId: "user-a"`, `../escape` is rejected, an existing target returns 409, and the administrator clones beneath `/research`.

- [ ] **Step 5: Fix Git clone**

Authenticate first, obtain `ensureEffectiveWorkspaceRoots(auth)[0]`, sanitize the derived or supplied folder name to one path segment, resolve it with provisioning access, clone only after authorization, and insert the canonical target with `getOwnerUserIdForWrite(auth)`. On clone failure, do not insert a workspace row; on insert failure, return 409 without claiming another user's path.

- [ ] **Step 6: Run route tests and commit**

Run:

```bash
npx vitest run src/app/api/workspaces/route.test.ts src/app/api/files/browse/route.test.ts src/app/api/files/mkdir/route.test.ts src/app/api/git/clone/route.test.ts
```

Expected: PASS.

Commit:

```bash
git add src/app/api/workspaces/route.ts src/app/api/workspaces/route.test.ts src/app/api/files/browse/route.ts src/app/api/files/browse/route.test.ts src/app/api/files/mkdir/route.ts src/app/api/files/mkdir/route.test.ts src/app/api/git/clone/route.ts src/app/api/git/clone/route.test.ts
git commit -m "fix(workspace): allow isolated first workspace creation"
```

---

### Task 10: Close Remaining Filesystem and Tool Escape Paths

**Files:**
- Create: `src/lib/auth/local-reference.ts`
- Create: `src/lib/auth/local-reference.test.ts`
- Modify: `src/app/api/paper-study/organize-notes/route.ts`
- Modify: `src/app/api/paper-study/find-related-notes/route.ts`
- Modify: `src/app/api/paper-study/quick-summary/route.ts`
- Modify: `src/app/api/paper-study/chat/route.ts`
- Modify: `src/app/api/paper-study/discuss/route.ts`
- Modify: `src/app/api/paper-study/generate-note/route.ts`
- Modify: `src/app/api/paper-study/ideate/route.ts`
- Add/modify: co-located tests for the seven routes above.
- Create: `src/lib/auth/privileges.ts`
- Create: `src/lib/auth/privileges.test.ts`
- Modify: `src/lib/ai/tools/types.ts`
- Modify: `src/lib/ai/tools/index.ts`
- Create: `src/lib/ai/tools/index.test.ts`
- Modify: `src/app/api/agent/route.ts`
- Modify: `src/app/api/terminal/exec/route.ts`
- Create: `src/app/api/terminal/exec/route.test.ts`

- [ ] **Step 1: Write failing local-reference tests**

Define `requireLocalReferenceAccess(request, reference)` so HTTP(S), DOI, and empty references need no filesystem check, while absolute local references call provisioning access. Test user A local files are accepted and user B files return 403.

- [ ] **Step 2: Guard paper-study filesystem inputs**

Before any `listDirectory`, `readFile`, extraction, rename, or create call:

- `organize-notes` and `find-related-notes` authorize `notesDir` with provisioning access;
- quick summary, chat, discuss, generate-note, and ideate authorize a local `article.url` through `requireLocalReferenceAccess` while leaving HTTP(S)/DOI sources unchanged.

Run each co-located route test and expect ordinary cross-user paths to return 403 before AI or filesystem mocks are called.

- [ ] **Step 3: Write failing high-risk privilege tests**

Create `src/lib/auth/privileges.test.ts`:

```typescript
expect(canUseHighRiskExecution(adminAuth)).toBe(true);
expect(canUseHighRiskExecution(userAuth)).toBe(false); // strict mode
process.env.AUTH_SINGLE_ADMIN = "false";
expect(canUseHighRiskExecution(userAuth)).toBe(true);  // compatibility
expect(canUseHighRiskExecution(ANONYMOUS_AUTH_CONTEXT)).toBe(true);
```

- [ ] **Step 4: Implement the privilege helper**

```typescript
export function canUseHighRiskExecution(auth: AuthContext): boolean {
  return isAuthDisabled() || !isSingleAdminMode() || auth.user.role === "admin";
}
```

- [ ] **Step 5: Write failing agent-tool boundary tests**

Construct tools for a strict-mode ordinary user and assert `bash`, K8s, MCP, and research-exec tool names are absent while `readFile`, `writeFile`, `listDirectory`, `grep`, and web search remain. Construct tools for an administrator and assert the high-risk tools remain. Call a file tool with an absolute path under user B and assert it rejects before `fsReadFile` is called.

- [ ] **Step 6: Anchor tool paths and filter high-risk tools**

Extend `createAgentTools` with an options object:

```typescript
interface AgentToolAccess {
  workspaceRoot?: string;
  allowHighRisk?: boolean;
}
```

Resolve every file-tool path with `resolvePathWithinRoots(resolved, [workspaceRoot ?? validatedCwd])`. Build safe file/search/skill tools unconditionally. Add `bash`, K8s, MCP, and research-exec tools only when `allowHighRisk !== false`; keep `grep` in the safe set. In `src/app/api/agent/route.ts`, pass the canonical database workspace folder and `canUseHighRiskExecution(workspaceAccess.auth)` for every mode/skill branch.

- [ ] **Step 7: Gate the direct terminal API**

After `requirePathAccess`, reject with 403 when `canUseHighRiskExecution(access.auth)` is false. For allowed administrators, re-run `requirePathAccess` on a `cd` destination before returning it.

- [ ] **Step 8: Run the full isolation-focused test set**

Run:

```bash
npx vitest run \
  src/lib/auth/local-reference.test.ts \
  src/lib/auth/privileges.test.ts \
  src/lib/ai/tools/index.test.ts \
  src/app/api/terminal/exec/route.test.ts \
  src/app/api/paper-study
```

Expected: PASS, with no AI network calls.

- [ ] **Step 9: Commit**

```bash
git add src/lib/auth/local-reference.ts src/lib/auth/local-reference.test.ts src/lib/auth/privileges.ts src/lib/auth/privileges.test.ts src/lib/ai/tools src/app/api/agent/route.ts src/app/api/terminal/exec src/app/api/paper-study
git commit -m "fix(auth): close cross-user execution paths"
```

---

### Task 11: Document the New Shared Contracts

**Files:**
- Modify: `.env.example`
- Modify: `.env.production.example`
- Modify: `docs/getting-started/environment-variables.md`
- Modify: `docs/docker.md`
- Modify: `docs/getting-started/deployment.md`
- Refresh: `docs/locales/zh_CN/LC_MESSAGES/*.po`

- [ ] **Step 1: Add example environment entries**

Document without real secrets:

```ini
# Enforce one bootstrapped administrator. Public registration creates users only.
# AUTH_SINGLE_ADMIN=false

# Override session Cookie Secure. Set false only for temporary plain-HTTP deployments.
# AUTH_COOKIE_SECURE=true
```

- [ ] **Step 2: Update the environment-variable reference**

Add type/default/security semantics for both variables. State that `AUTH_COOKIE_SECURE=false` does not encrypt credentials or sessions, and that `AUTH_SINGLE_ADMIN=true` requires the bootstrap CLI before public registration becomes available.

- [ ] **Step 3: Add the Docker bootstrap workflow**

Document this secret-safe shape, using placeholders only:

```bash
openssl rand -base64 32 > /tmp/innoclaw-admin-password
chmod 600 /tmp/innoclaw-admin-password
docker compose exec -T innoclaw node /app/admin-cli/scripts/bootstrap-admin.js \
  --email admin@innoclaw.local --name Administrator \
  < /tmp/innoclaw-admin-password
```

Document deletion of the temporary file after secure delivery, per-user path layout, database backup, and switching `AUTH_COOKIE_SECURE` back to true for HTTPS.

- [ ] **Step 4: Refresh and build docs**

Run:

```bash
cd docs
make update-po
make html
make html-zh
```

Expected: all commands succeed without warnings promoted to failures.

- [ ] **Step 5: Commit**

```bash
git add .env.example .env.production.example docs/getting-started/environment-variables.md docs/docker.md docs/getting-started/deployment.md docs/locales/zh_CN/LC_MESSAGES
git commit -m "docs(auth): document single-admin deployment"
```

---

### Task 12: Run Local Acceptance and Prepare the Protected Rollout

**Files:**
- No product-code changes expected.
- Write local evidence under ignored scratch paths only; do not commit secrets or generated build output.

- [ ] **Step 1: Run the named focused acceptance suites**

Run:

```bash
npx vitest run \
  src/lib/auth/policy.test.ts \
  src/lib/auth/admin-policy.test.ts \
  src/lib/auth/bootstrap-admin.test.ts \
  src/lib/auth/workspace-roots.test.ts \
  src/lib/auth/ownership.test.ts \
  src/lib/files/canonical-path.test.ts \
  src/lib/db/workspace-path-preflight.test.ts \
  src/app/api/auth/register/route.test.ts \
  src/app/api/admin/users/route.test.ts \
  src/app/api/workspaces/route.test.ts \
  src/app/api/files/browse/route.test.ts \
  src/app/api/files/mkdir/route.test.ts \
  src/app/api/git/clone/route.test.ts \
  src/lib/ai/tools/index.test.ts \
  src/app/api/terminal/exec/route.test.ts
```

Expected: PASS. This is the direct evidence for the unique-admin, fixed registration role, bootstrap idempotence, Cookie behavior, two-user isolation, administrator-global access, first-workspace, path conflict, symlink escape, and concurrent uniqueness requirements.

- [ ] **Step 2: Run repository validation**

Run exactly:

```bash
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Expected: all exit 0.

- [ ] **Step 3: Build and inspect the release image**

Run:

```bash
docker build -t innoclaw:single-admin-candidate .
docker run --rm --entrypoint test innoclaw:single-admin-candidate -f /app/admin-cli/scripts/bootstrap-admin.js
```

Expected: the image builds and contains the bootstrap CLI.

- [ ] **Step 4: Record the rollout checklist**

The execution session must not remove Basic Auth until it has current evidence for all of these gates:

1. remote database, environment, Nginx config, and current image backed up;
2. new container healthy behind the existing Basic Auth gate;
3. migration and canonical-path preflight successful;
4. random `AUTH_SECRET`, `AUTH_MODE=local`, `AUTH_SINGLE_ADMIN=true`, and `AUTH_COOKIE_SECURE=false` loaded;
5. `admin@innoclaw.local` bootstrapped from stdin and login verified;
6. public registration creates only an ordinary user;
7. two temporary users cannot access one another's paths and the administrator can access both;
8. model inference gate from the separate reasoning-effort plan passes;
9. Nginx auth rate limits validate and `nginx -t` succeeds;
10. only then remove `auth_basic`, reload Nginx, and re-run public smoke tests.

- [ ] **Step 5: Do not commit validation-only artifacts**

Run `git status --short`. Expected: only intentional source/docs changes or the pre-existing ignored/untracked user directories; no database, environment, password, build, or test-output artifacts are staged.

---

### Task 13: Execute the Protected Remote Rollout and Rollback Audit

**Files:**
- Remote: `/opt/innoclaw/.env.production.local`
- Remote: active Nginx site for `106.75.210.30`
- Remote: `/opt/innoclaw` source checkout and Docker Compose project
- Remote backup root: `/opt/innoclaw/backups/$STAMP` created with mode 0700

- [ ] **Step 1: Capture remote preflight state without secrets**

Over SSH, record only command success, image IDs, container health/status, disk space, and tracked worktree status:

```bash
cd /opt/innoclaw
git status --short
docker compose ps
docker inspect --format '{{.Image}}' innoclaw-innoclaw-1
df -h /opt/innoclaw
sudo nginx -t
```

Expected: no unknown tracked edits, current container running, sufficient disk, Nginx config valid. Do not print the environment file.

- [ ] **Step 2: Create restorable backups while Basic Auth stays active**

Set a timestamp and create a root-only directory. Use better-sqlite3's online backup API from the running container so WAL state is included, then copy the result to the host backup directory. Copy `.env.production.local` and the active Nginx site with `sudo install -m 600`. Tag the current image ID as `innoclaw:rollback-$STAMP` and write the ID to a root-readable text file.

Verify backup file sizes are non-zero and run `PRAGMA integrity_check` against the database backup. Expected: `ok`.

- [ ] **Step 3: Transfer and build the exact local commit**

Create a local Git bundle containing HEAD, transfer it to a root-only remote staging path, and in `/opt/innoclaw` fetch that commit. Abort if tracked remote edits overlap. Check out the fetched commit detached, then run:

```bash
docker compose build innoclaw
```

Expected: build succeeds; do not recreate the container yet if the environment backup or rollback image is missing.

- [ ] **Step 4: Update the private environment without echoing secrets**

Edit `/opt/innoclaw/.env.production.local` with mode 600 so it contains:

```ini
AUTH_MODE=local
AUTH_SINGLE_ADMIN=true
AUTH_COOKIE_SECURE=false
WORKSPACE_ROOTS=/research
LLM_PROVIDER=openai
LLM_MODEL=gpt-5.6-sol
OPENAI_BASE_URL=http://47.88.18.125:8080/v1
OPENAI_REASONING_EFFORT=ultra
```

Generate a fresh 32-byte `AUTH_SECRET` on the remote host and retain the already supplied `OPENAI_API_KEY`; update both through a script that prints only key names, and verify file permissions with `stat`; never display values.

- [ ] **Step 5: Recreate behind the still-active Basic Auth gate**

Run:

```bash
cd /opt/innoclaw
docker compose up -d --no-deps innoclaw
docker compose ps
docker compose logs --tail=200 innoclaw
```

Expected: container running, migration succeeds, workspace root is writable, and logs contain no secret values or migration/provider configuration errors.

- [ ] **Step 6: Bootstrap and verify the administrator without logging the password**

Generate a 32-byte random password into a mode-600 temporary file, pipe it to `/app/admin-cli/scripts/bootstrap-admin.js`, and retain it only until secure delivery. Call the bootstrap command twice; expected results are `created` then `already exists`, with one active admin row. Log in through `http://127.0.0.1:3000/api/auth/login` using a cookie jar and assert HTTP 200 plus three non-Secure HttpOnly session cookies.

- [ ] **Step 7: Verify two-user registration and workspace isolation**

Through localhost, register two randomly named temporary users. Assert both `/api/auth/me` responses report `role: "user"`. For each user, fetch `/api/settings` and assert its root equals `/research/users/` followed by that response's immutable user ID.

Create one directory/workspace per user, then verify:

- user A can browse/read/write A's path;
- user B can browse/read/write B's path;
- user A receives 403 for B's path and workspace ID;
- user B receives 403 for A's path and workspace ID;
- a symlink created under A pointing at B is rejected with 403;
- the administrator lists both workspace rows and can access both.

Delete the symlink and keep the temporary users until inference validation finishes.

- [ ] **Step 8: Verify real InnoClaw inference**

Use one authenticated temporary user's workspace and construct the `/api/chat` body without interpolation errors:

```bash
jq -n --arg workspaceId "$USER_A_WORKSPACE_ID" '{
  workspaceId: $workspaceId,
  messages: [{
    id: "reasoning-smoke",
    role: "user",
    parts: [{type: "text", text: "Return exactly INNOCLAW_XHIGH_OK"}]
  }]
}' > "$SMOKE_DIR/reasoning-request.json"
```

Expected: HTTP 200 streaming response containing `INNOCLAW_XHIGH_OK`; container logs identify `openai` and `gpt-5.6-sol` and contain no 400 reasoning-effort error. This result, combined with the direct upstream literal-`ultra` rejection and `xhigh` success, proves application normalization.

- [ ] **Step 9: Add and validate Nginx authentication rate limits**

In the Nginx `http` context add:

```nginx
limit_req_zone $binary_remote_addr zone=innoclaw_login:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=innoclaw_register:10m rate=1r/m;
```

In the existing port-80 server, keep server-level Basic Auth active and add exact API locations using the current upstream:

```nginx
location = /api/auth/login {
    limit_req zone=innoclaw_login burst=10 nodelay;
    limit_req_status 429;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /api/auth/register {
    limit_req zone=innoclaw_register burst=2 nodelay;
    limit_req_status 429;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Keep the existing general proxy location unchanged.

Run `sudo nginx -t`, reload, then send enough invalid localhost/proxied requests to observe 429 without logging credentials. Expected: normal requests still proxy and excess requests receive 429.

- [ ] **Step 10: Remove Basic Auth only after all gates pass**

Remove only the `auth_basic` and `auth_basic_user_file` directives, leave proxying and rate limits intact, run `sudo nginx -t`, and reload. From a separate public client verify:

```text
GET /                       -> 302 or login page, no WWW-Authenticate header
GET /login                  -> 200
unauthenticated GET /api/workspaces -> 401
administrator login         -> 200
ordinary-user login         -> 200
public port 80              -> reachable
host port 3000              -> not publicly reachable
```

- [ ] **Step 11: Clean temporary validation identities and securely deliver credentials**

Use the administrator API to delete both temporary ordinary users and transfer their database records to the administrator, then remove only the known temporary workspace directories. Confirm no unrelated workspace data is deleted. Deliver the administrator email and generated password to the operator, then securely remove the temporary password file.

- [ ] **Step 12: Exercise rollback readiness before declaring success**

Verify the rollback image exists, backup database passes integrity check, environment/Nginx backups are readable only by root, and the old Basic Auth configuration can pass `nginx -t` from its backup copy. If any rollout gate failed, restore Nginx first, restore the environment/database as required, recreate `innoclaw:rollback-$STAMP`, and verify the old protected page before stopping work.
