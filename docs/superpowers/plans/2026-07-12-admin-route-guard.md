# Administrator Route Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure ordinary users can neither render administrator pages nor reach them through login or registration `next` redirects, while preserving administrator behavior and all existing persisted data.

**Architecture:** Add a client-safe pure redirect policy that layers role authorization on top of the existing internal-path safety checks. Enforce the authoritative role again in the `/admin/users` server component using the existing cookie-backed `getAuthContext()`, leaving the API's `requireAdmin()` guard intact. Deploy only application code after a current SQLite/config/image backup, with no schema or environment changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Vitest 4, Docker Compose, Nginx, SQLite/better-sqlite3.

---

## File Structure

- Create: `src/lib/auth/redirect-policy.ts`
  - Pure role-aware post-auth redirect resolution usable by client components.
- Create: `src/lib/auth/redirect-policy.test.ts`
  - Allow/deny matrix for ordinary users, administrators, malformed paths, queries, and encoded administrator paths.
- Modify: `src/app/admin/users/page.tsx`
  - Resolve the cookie-backed auth context and render only for administrators.
- Modify: `src/app/admin/users/page.test.tsx`
  - Disabled-auth, missing-session, ordinary-user, and administrator page behavior.
- Modify: `src/app/login/page.tsx`
  - Apply role-aware redirect resolution to existing-session, credential login, and CLI handoff paths.
- Modify: `src/app/login/page.test.tsx`
  - Confirm an ordinary authenticated user with `next=/admin/users` returns home while a normal workspace target remains unchanged.
- Modify: `src/app/register/page.tsx`
  - Use the role returned by registration, or the current authenticated user's role for CLI handoff, before following `next`.
- Modify: `src/app/register/page.test.tsx`
  - Reproduce the observed ordinary-user registration destination and confirm it resolves home.

## Task 1: Add the Role-Aware Redirect Contract

**Files:**
- Create: `src/lib/auth/redirect-policy.ts`
- Create: `src/lib/auth/redirect-policy.test.ts`

- [ ] **Step 1: Write the failing redirect-policy tests**

Create `src/lib/auth/redirect-policy.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { resolveRoleAwareRedirectPath } from "./redirect-policy";

describe("resolveRoleAwareRedirectPath", () => {
  it.each(["/admin", "/admin/users", "/admin/users?tab=active", "/admin%2Fusers"])(
    "redirects an ordinary user away from %s",
    (next) => {
      expect(resolveRoleAwareRedirectPath(next, "user", "/")).toBe("/");
    },
  );

  it.each(["/", "/workspace", "/workspace/id", "/settings"])(
    "keeps an ordinary user's allowed destination %s",
    (next) => {
      expect(resolveRoleAwareRedirectPath(next, "user", "/")).toBe(next);
    },
  );

  it("does not confuse a non-admin prefix with an administrator route", () => {
    expect(resolveRoleAwareRedirectPath("/administrator", "user", "/")).toBe("/administrator");
  });

  it("allows an administrator destination for an administrator", () => {
    expect(resolveRoleAwareRedirectPath("/admin/users", "admin", "/admin/users"))
      .toBe("/admin/users");
  });

  it("preserves the existing unsafe-path fallback", () => {
    expect(resolveRoleAwareRedirectPath("https://evil.example", "user", "/"))
      .toBe("/");
  });

  it("never uses an administrator fallback for an ordinary user", () => {
    expect(resolveRoleAwareRedirectPath(null, "user", "/admin/users")).toBe("/");
  });
});
```

- [ ] **Step 2: Run the test and verify the expected red state**

Run: `npx vitest run src/lib/auth/redirect-policy.test.ts`

Expected: FAIL because `src/lib/auth/redirect-policy.ts` does not exist.

- [ ] **Step 3: Implement the minimal redirect policy**

Create `src/lib/auth/redirect-policy.ts`:

```typescript
import { resolveSafeRedirectPath } from "./cli-handoff";
import type { PublicUser } from "@/types/auth";

type AuthRole = PublicUser["role"];

function isAdministratorPath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded === "/admin" || decoded.startsWith("/admin/");
  } catch {
    return false;
  }
}

export function resolveRoleAwareRedirectPath(
  value: string | null | undefined,
  role: AuthRole,
  fallback = "/",
): string {
  const safeFallback = resolveSafeRedirectPath(fallback, "/");
  const allowedFallback = role === "user" && isAdministratorPath(safeFallback)
    ? "/"
    : safeFallback;
  const resolved = resolveSafeRedirectPath(value, allowedFallback);
  return role === "user" && isAdministratorPath(resolved)
    ? allowedFallback
    : resolved;
}
```

- [ ] **Step 4: Run the focused test and verify green**

Run: `npx vitest run src/lib/auth/redirect-policy.test.ts src/lib/auth/cli-handoff.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the isolated policy contract**

```bash
git add src/lib/auth/redirect-policy.ts src/lib/auth/redirect-policy.test.ts
git commit -m "fix(auth): add role-aware redirect policy"
```

## Task 2: Guard the Administrator Page on the Server

**Files:**
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/app/admin/users/page.test.tsx`

- [ ] **Step 1: Add failing page-authorization tests**

Hoist a `getAuthContext` mock in `page.test.tsx`, return a complete ordinary-user context, and assert `await UserManagementPage()` rejects with `redirect:/`. Add a second test returning an administrator context and assert the rendered result contains `User management`. Keep the authentication-disabled test and assert it redirects without querying the database.

The ordinary-user fixture must use this role field:

```typescript
getAuthContextMock.mockResolvedValue({
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "User",
    role: "user",
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  session: { id: "session-1", expiresAt: "2030-01-01T00:00:00.000Z" },
  token: "token-1",
});
```

- [ ] **Step 2: Run the page test and verify the expected red state**

Run: `npx vitest run src/app/admin/users/page.test.tsx`

Expected: FAIL because the current page renders for an ordinary user and never calls `getAuthContext()`.

- [ ] **Step 3: Implement the authoritative page guard**

Change `src/app/admin/users/page.tsx` to:

```typescript
import { redirect } from "next/navigation";
import { isAuthDisabled } from "@/lib/auth/mode";
import { getAuthContext } from "@/lib/auth/server";
import { UserManagementClient } from "./user-management-client";

export default async function UserManagementPage() {
  if (isAuthDisabled()) {
    redirect("/");
  }

  const auth = await getAuthContext();
  if (!auth || auth.user.role !== "admin") {
    redirect("/");
  }

  return <UserManagementClient />;
}
```

- [ ] **Step 4: Run the page test and verify green**

Run: `npx vitest run src/app/admin/users/page.test.tsx src/app/api/admin/users/route.test.ts`

Expected: PASS and retain API `requireAdmin()` coverage.

- [ ] **Step 5: Commit the page boundary**

```bash
git add src/app/admin/users/page.tsx src/app/admin/users/page.test.tsx
git commit -m "fix(auth): restrict user management page to admins"
```

## Task 3: Wire Login and Registration Through the Policy

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/login/page.test.tsx`
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/register/page.test.tsx`

- [ ] **Step 1: Reproduce the page-level redirect bug in tests**

Make each page test's mocked `next` value mutable and reset it to `/workspace` after every test. Add one test per page that sets `next=/admin/users`, renders the ordinary user's authenticated CLI handoff state, triggers the existing captured handoff button, and expects `router.replace("/")`.

Expected assertions for each new test:

```typescript
expect(completeCliBrowserHandoffMock).toHaveBeenCalledTimes(1);
expect(replaceMock).toHaveBeenCalledWith("/");
expect(refreshMock).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run both page tests and verify the expected red state**

Run: `npx vitest run src/app/login/page.test.tsx src/app/register/page.test.tsx`

Expected: FAIL because both pages currently call `resolveSafeRedirectPath()` and follow `/admin/users` for an ordinary user.

- [ ] **Step 3: Apply role-aware resolution to every post-auth path**

In `login/page.tsx`, import `resolveRoleAwareRedirectPath`, remove the direct `resolveSafeRedirectPath` import, and use:

```typescript
function resolvePostLoginPath(role: "admin" | "user"): string {
  const fallback = role === "admin" ? "/admin/users" : "/";
  return resolveRoleAwareRedirectPath(searchParams.get("next"), role, fallback);
}
```

Use that function from the existing-session effect, credential login, and CLI handoff.

In `register/page.tsx`, import `resolveRoleAwareRedirectPath`, remove the direct `resolveSafeRedirectPath` import, and use:

```typescript
function resolvePostRegisterPath(
  role: "admin" | "user",
  requiresSetup = false,
): string {
  return resolveRoleAwareRedirectPath(
    searchParams.get("next"),
    role,
    requiresSetup ? "/settings" : "/",
  );
}
```

After a successful registration, pass `data.user?.role === "admin" ? "admin" : "user"`. For authenticated CLI handoff, pass `user?.role === "admin" ? "admin" : "user"`.

- [ ] **Step 4: Run the auth-page and redirect tests and verify green**

Run:

```bash
npx vitest run \
  src/lib/auth/redirect-policy.test.ts \
  src/app/login/page.test.tsx \
  src/app/register/page.test.tsx \
  src/app/admin/users/page.test.tsx
```

Expected: PASS, including the existing `/workspace` CLI handoff tests.

- [ ] **Step 5: Commit the post-auth wiring**

```bash
git add src/app/login/page.tsx src/app/login/page.test.tsx src/app/register/page.tsx src/app/register/page.test.tsx
git commit -m "fix(auth): block user redirects to admin routes"
```

## Task 4: Repository Validation and Review

**Files:**
- Review all files changed since `6f8c3185`.

- [ ] **Step 1: Verify type checking and focused behavior**

Run:

```bash
npx tsc --noEmit
npx vitest run src/lib/auth/redirect-policy.test.ts src/app/admin/users/page.test.tsx src/app/login/page.test.tsx src/app/register/page.test.tsx src/app/api/admin/users/route.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 2: Run the repository validation matrix**

Run:

```bash
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Expected: lint has zero errors, all Vitest tests pass, and the production build exits 0.

- [ ] **Step 3: Inspect the final diff and contracts**

Run:

```bash
git diff --check 6f8c3185..HEAD
git status --short
git log --oneline 6f8c3185..HEAD
```

Expected: no whitespace errors, a clean worktree, and only design/plan/auth guard commits. Confirm there is no database migration, environment-variable change, API response change, or secret.

## Task 5: Protected Docker Deployment and Live Verification

**Files and state:**
- Local commit bundle generated from the verified HEAD.
- Remote source and Compose project: `/opt/innoclaw`.
- Remote root-only backup: `/opt/innoclaw/backups/$STAMP`.
- Existing Docker volume/database, `.env.production.local`, and Nginx configuration remain in place.

- [ ] **Step 1: Capture secret-free remote preflight evidence**

Over SSH, record only `git status --short`, the current commit, `docker compose ps`, the running image ID, disk availability, and `sudo nginx -t`. Do not display environment values, cookies, passwords, or API keys.

- [ ] **Step 2: Create rollback assets before changing the container**

Create a mode-0700 timestamped directory. Use better-sqlite3's online backup API from the running container, validate the copied database with `PRAGMA integrity_check`, install copies of `.env.production.local` and the active Nginx site at mode 0600, and tag the current image as `innoclaw:rollback-$STAMP`.

Expected: database integrity reports `ok`, config backups are non-empty and root-only, and the rollback image ID matches the preflight image.

- [ ] **Step 3: Transfer and build the exact verified commit**

Create a Git bundle containing the verified branch HEAD, transfer it to a remote mode-0700 staging directory, fetch the commit into `/opt/innoclaw`, and check it out detached only if tracked remote changes do not overlap. Run:

```bash
docker compose build innoclaw
docker compose up -d --no-deps innoclaw
docker compose ps
docker compose logs --tail=200 innoclaw
```

Expected: build succeeds, the container is running, existing persistent volumes remain attached, and startup logs contain no migration or authentication error.

- [ ] **Step 4: Verify ordinary-user behavior without altering an existing account**

Register one uniquely named temporary ordinary user through localhost with a root-only cookie jar. Assert the registration response role is `user`, then request `/admin/users` without following redirects and assert a redirect to `/`. Assert `/api/admin/users` returns 403 with the same session. Verify an allowed page such as `/` remains reachable.

- [ ] **Step 5: Verify administrator behavior and clean temporary state**

Use an existing administrator session or a short-lived server-generated test session without changing the administrator password. Assert `/admin/users` returns 200 and `/api/admin/users` returns 200. Remove only the uniquely named temporary user and its test sessions through the administrator API, then verify the pre-existing user/workspace counts and identifiers are unchanged.

- [ ] **Step 6: Verify public port 80 and rollback readiness**

From the external client, assert `/login` returns 200, unauthenticated `/admin/users` redirects through login, and no `WWW-Authenticate` Basic Auth challenge is present. Re-check `docker compose ps`, recent error logs, backup integrity, backup permissions, and the rollback image tag before declaring completion.
