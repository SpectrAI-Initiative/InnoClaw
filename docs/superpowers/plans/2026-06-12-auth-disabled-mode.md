# Auth Disabled Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a supported startup mode that lets trusted single-user deployments run InnoClaw without registration or login.

**Architecture:** Add a small auth-mode module that parses `AUTH_MODE` and exposes a shared anonymous admin context. Wire it through middleware, server auth helpers, auth endpoints, and the header account UI while preserving existing route-level authorization helpers.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Drizzle-backed existing auth helpers, npm scripts.

---

## File Structure

- Create: `src/lib/auth/mode.ts`
  - Owns `AUTH_MODE` parsing, disabled-auth detection, and the anonymous admin user/session constants.
- Create: `src/lib/auth/mode.test.ts`
  - Unit tests for default auth mode, disabled mode parsing, anonymous context shape, and session expiry shape.
- Modify: `middleware.ts`
  - Imports disabled-auth detection and bypasses cookie checks/redirects when disabled.
- Create: `src/lib/auth/middleware-policy.ts`
  - Extracts pure middleware decisions for focused tests without needing a full Next middleware harness.
- Create: `src/lib/auth/middleware-policy.test.ts`
  - Verifies disabled mode allows protected pages and APIs.
- Modify: `src/lib/auth/server.ts`
  - Returns anonymous admin auth context when auth is disabled.
- Create: `src/lib/auth/server.test.ts`
  - Tests `getAuthContext`, `requireAuth`, and `requireAdmin` in disabled mode.
- Modify: `src/app/api/auth/me/route.ts`
  - Avoids refreshing a non-persistent disabled-auth session.
- Modify: `src/app/api/auth/login/route.ts`
  - Rejects login attempts with `403` when auth is disabled.
- Modify: `src/app/api/auth/register/route.ts`
  - Rejects registration attempts with `403` when auth is disabled.
- Create: `src/app/api/auth/login/route.test.ts`
  - Verifies login rejection in disabled mode.
- Create: `src/app/api/auth/register/route.test.ts`
  - Verifies registration rejection in disabled mode.
- Modify: `src/lib/hooks/use-auth.ts`
  - Exposes `authMode`/`isAuthDisabled` from `/api/auth/me` response.
- Modify: `src/types/auth.ts`
  - Adds auth mode fields to shared client auth response types.
- Modify: `src/components/layout/user-menu.tsx`
  - Hides account-only menu controls when auth is disabled.
- Modify: `src/app/login/page.tsx` and `src/app/register/page.tsx`
  - Redirects to `/` or displays a no-auth state when auth is disabled.
- Modify: `package.json`
  - Adds no-auth convenience scripts using `cross-env`.
- Add dependency: `cross-env`
  - Makes environment-setting scripts work on Windows and Unix.
- Modify: `.env.example`
  - Documents `AUTH_MODE=disabled`.
- Modify: `docs/getting-started/environment-variables.md`
  - Adds `AUTH_MODE`.
- Modify: `AGENTS.md` and `docs/development/contributing.md`.
  - Documents new contributor-facing startup commands.

---

### Task 1: Auth Mode Module

**Files:**
- Create: `src/lib/auth/mode.ts`
- Create: `src/lib/auth/mode.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/auth/mode.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import {
  ANONYMOUS_AUTH_CONTEXT,
  ANONYMOUS_AUTH_MODE_SESSION_EXPIRES_AT,
  getAuthMode,
  isAuthDisabled,
} from "./mode";

const originalAuthMode = process.env.AUTH_MODE;

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("auth mode", () => {
  it("defaults to local auth when AUTH_MODE is unset", () => {
    delete process.env.AUTH_MODE;

    expect(getAuthMode()).toBe("local");
    expect(isAuthDisabled()).toBe(false);
  });

  it("treats AUTH_MODE=disabled as disabled auth", () => {
    process.env.AUTH_MODE = "disabled";

    expect(getAuthMode()).toBe("disabled");
    expect(isAuthDisabled()).toBe(true);
  });

  it("normalizes whitespace and case", () => {
    process.env.AUTH_MODE = " Disabled ";

    expect(getAuthMode()).toBe("disabled");
  });

  it("falls back to local auth for unknown values", () => {
    process.env.AUTH_MODE = "off";

    expect(getAuthMode()).toBe("local");
    expect(isAuthDisabled()).toBe(false);
  });

  it("provides an anonymous admin context for disabled auth", () => {
    expect(ANONYMOUS_AUTH_CONTEXT.user).toMatchObject({
      id: "anonymous-admin",
      email: "anonymous@local",
      name: "Anonymous Admin",
      role: "admin",
      isActive: true,
    });
    expect(ANONYMOUS_AUTH_CONTEXT.token).toBe("anonymous-disabled-auth");
    expect(ANONYMOUS_AUTH_CONTEXT.session.expiresAt).toBe(ANONYMOUS_AUTH_MODE_SESSION_EXPIRES_AT);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/auth/mode.test.ts`

Expected: FAIL because `src/lib/auth/mode.ts` does not exist.

- [ ] **Step 3: Implement the auth mode module**

Create `src/lib/auth/mode.ts`:

```typescript
import type { AuthContext } from "./server";

export type AuthMode = "local" | "disabled";

export const ANONYMOUS_AUTH_MODE_SESSION_EXPIRES_AT = "9999-12-31T23:59:59.999Z";

export const ANONYMOUS_AUTH_CONTEXT: AuthContext = {
  user: {
    id: "anonymous-admin",
    email: "anonymous@local",
    name: "Anonymous Admin",
    role: "admin",
    isActive: true,
    lastLoginAt: null,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
  },
  session: {
    id: "anonymous-disabled-auth",
    expiresAt: ANONYMOUS_AUTH_MODE_SESSION_EXPIRES_AT,
  },
  token: "anonymous-disabled-auth",
};

export function getAuthMode(): AuthMode {
  return process.env.AUTH_MODE?.trim().toLowerCase() === "disabled" ? "disabled" : "local";
}

export function isAuthDisabled(): boolean {
  return getAuthMode() === "disabled";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth/mode.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/mode.ts src/lib/auth/mode.test.ts
git commit -m "feat(auth): add disabled auth mode config"
```

---

### Task 2: Middleware Disabled-Auth Bypass

**Files:**
- Create: `src/lib/auth/middleware-policy.ts`
- Create: `src/lib/auth/middleware-policy.test.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Write the failing middleware policy tests**

Create `src/lib/auth/middleware-policy.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getAuthMiddlewareAction } from "./middleware-policy";

describe("auth middleware policy", () => {
  it("allows protected pages when auth is disabled", () => {
    expect(getAuthMiddlewareAction({ pathname: "/workspace/abc", authDisabled: true, hasSession: false })).toEqual({
      type: "next",
    });
  });

  it("allows protected APIs when auth is disabled", () => {
    expect(getAuthMiddlewareAction({ pathname: "/api/workspaces", authDisabled: true, hasSession: false })).toEqual({
      type: "next",
    });
  });

  it("redirects protected pages without a session in local auth mode", () => {
    expect(getAuthMiddlewareAction({ pathname: "/workspace/abc", authDisabled: false, hasSession: false })).toEqual({
      type: "redirect-login",
    });
  });

  it("rejects protected APIs without a session in local auth mode", () => {
    expect(getAuthMiddlewareAction({ pathname: "/api/workspaces", authDisabled: false, hasSession: false })).toEqual({
      type: "unauthorized-json",
    });
  });

  it("allows public auth routes in local auth mode", () => {
    expect(getAuthMiddlewareAction({ pathname: "/login", authDisabled: false, hasSession: false })).toEqual({
      type: "next",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/auth/middleware-policy.test.ts`

Expected: FAIL because `middleware-policy.ts` does not exist.

- [ ] **Step 3: Implement the pure middleware policy**

Create `src/lib/auth/middleware-policy.ts`:

```typescript
import { AUTH_PUBLIC_API_PREFIXES, AUTH_PUBLIC_PATHS } from "./constants";

export type AuthMiddlewareAction =
  | { type: "next" }
  | { type: "unauthorized-json" }
  | { type: "redirect-login" };

export interface AuthMiddlewarePolicyInput {
  pathname: string;
  authDisabled: boolean;
  hasSession: boolean;
}

export function isPublicPath(pathname: string): boolean {
  if (AUTH_PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  return pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname.includes(".");
}

export function isPublicApi(pathname: string): boolean {
  return AUTH_PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function getAuthMiddlewareAction({
  pathname,
  authDisabled,
  hasSession,
}: AuthMiddlewarePolicyInput): AuthMiddlewareAction {
  if (authDisabled || isPublicPath(pathname) || isPublicApi(pathname) || hasSession) {
    return { type: "next" };
  }

  if (pathname.startsWith("/api/")) {
    return { type: "unauthorized-json" };
  }

  return { type: "redirect-login" };
}
```

- [ ] **Step 4: Wire middleware through the policy**

Modify `middleware.ts` imports:

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_EXPIRES_COOKIE,
  AUTH_SESSION_SIGNATURE_COOKIE,
} from "@/lib/auth/constants";
import { getAuthMiddlewareAction } from "@/lib/auth/middleware-policy";
import { isAuthDisabled } from "@/lib/auth/mode";
```

Remove local `isPublicPath` and `isPublicApi` functions from `middleware.ts`.

Replace the early decision section in `middleware` with:

```typescript
  const hasSession = await hasValidSessionMarker(request);
  const action = getAuthMiddlewareAction({
    pathname,
    authDisabled: isAuthDisabled(),
    hasSession,
  });

  if (action.type === "next") {
    return NextResponse.next();
  }

  if (action.type === "unauthorized-json") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth/middleware-policy.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts src/lib/auth/middleware-policy.ts src/lib/auth/middleware-policy.test.ts
git commit -m "feat(auth): bypass middleware in disabled mode"
```

---

### Task 3: Server Auth Helpers Use Anonymous Admin

**Files:**
- Modify: `src/lib/auth/server.ts`
- Create: `src/lib/auth/server.test.ts`
- Modify: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: Write the failing server auth tests**

Create `src/lib/auth/server.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireAdmin, requireAuth } from "./server";

const originalAuthMode = process.env.AUTH_MODE;

function requestFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost"));
}

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("server auth disabled mode", () => {
  it("returns anonymous admin auth without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await getAuthContext(requestFor("/api/workspaces"));

    expect(auth?.user).toMatchObject({
      id: "anonymous-admin",
      email: "anonymous@local",
      role: "admin",
      isActive: true,
    });
    expect(auth?.session.id).toBe("anonymous-disabled-auth");
  });

  it("makes requireAuth succeed without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await requireAuth(requestFor("/api/workspaces"));

    expect(auth).not.toBeInstanceOf(NextResponse);
    if (!(auth instanceof NextResponse)) {
      expect(auth.user.id).toBe("anonymous-admin");
    }
  });

  it("makes requireAdmin succeed without cookies", async () => {
    process.env.AUTH_MODE = "disabled";

    const auth = await requireAdmin(requestFor("/api/settings"));

    expect(auth).not.toBeInstanceOf(NextResponse);
    if (!(auth instanceof NextResponse)) {
      expect(auth.user.role).toBe("admin");
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/auth/server.test.ts`

Expected: FAIL because `getAuthContext` still returns `null` without cookies.

- [ ] **Step 3: Implement disabled-auth return path**

In `src/lib/auth/server.ts`, add import:

```typescript
import { ANONYMOUS_AUTH_CONTEXT, isAuthDisabled } from "./mode";
```

At the start of `getAuthContext`, before reading cookies, add:

```typescript
  if (isAuthDisabled()) {
    return ANONYMOUS_AUTH_CONTEXT;
  }
```

At the start of `refreshAuthSessionIfNeeded`, add:

```typescript
  if (isAuthDisabled()) {
    return response;
  }
```

At the start of `revokeCurrentSession`, add:

```typescript
  if (isAuthDisabled()) {
    return;
  }
```

- [ ] **Step 4: Update `/api/auth/me` response shape**

Modify `src/app/api/auth/me/route.ts` imports:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, refreshAuthSessionIfNeeded, unauthorizedResponse } from "@/lib/auth/server";
import { getAuthMode, isAuthDisabled } from "@/lib/auth/mode";
```

Replace the response body with:

```typescript
  const response = NextResponse.json({
    user: auth.user,
    session: { expiresAt: auth.session.expiresAt },
    authMode: getAuthMode(),
    isAuthDisabled: isAuthDisabled(),
  });
```

Keep the existing `return refreshAuthSessionIfNeeded(response, auth);`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/auth/server.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/server.ts src/lib/auth/server.test.ts src/app/api/auth/me/route.ts
git commit -m "feat(auth): use anonymous admin when auth is disabled"
```

---

### Task 4: Auth Endpoint Rejection In Disabled Mode

**Files:**
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/login/route.test.ts`
- Create: `src/app/api/auth/register/route.test.ts`

- [ ] **Step 1: Write failing login/register route tests**

Create `src/app/api/auth/login/route.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const originalAuthMode = process.env.AUTH_MODE;

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("POST /api/auth/login", () => {
  it("rejects login when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";
    const request = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Authentication is disabled");
  });
});
```

Create `src/app/api/auth/register/route.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const originalAuthMode = process.env.AUTH_MODE;

afterEach(() => {
  if (originalAuthMode === undefined) {
    delete process.env.AUTH_MODE;
  } else {
    process.env.AUTH_MODE = originalAuthMode;
  }
});

describe("POST /api/auth/register", () => {
  it("rejects registration when auth is disabled", async () => {
    process.env.AUTH_MODE = "disabled";
    const request = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("Authentication is disabled");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/auth/login/route.test.ts src/app/api/auth/register/route.test.ts`

Expected: FAIL because endpoints still process login/register.

- [ ] **Step 3: Implement login/register disabled-mode rejection**

In `src/app/api/auth/login/route.ts`, add import:

```typescript
import { isAuthDisabled } from "@/lib/auth/mode";
```

At the top of `POST`, before `try`, add:

```typescript
  if (isAuthDisabled()) {
    return jsonError("Authentication is disabled", 403);
  }
```

In `src/app/api/auth/register/route.ts`, add the same import and the same early return at the top of `POST`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/auth/login/route.test.ts src/app/api/auth/register/route.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/login/route.ts src/app/api/auth/login/route.test.ts src/app/api/auth/register/route.ts src/app/api/auth/register/route.test.ts
git commit -m "feat(auth): reject account operations when auth is disabled"
```

---

### Task 5: Client Auth State And Account UI

**Files:**
- Modify: `src/types/auth.ts`
- Modify: `src/lib/hooks/use-auth.ts`
- Modify: `src/components/layout/user-menu.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: Add client response types**

Modify `src/types/auth.ts`:

```typescript
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AuthMode = "local" | "disabled";

export interface AuthMeResponse {
  user: PublicUser;
  session: {
    expiresAt: string;
  };
  authMode: AuthMode;
  isAuthDisabled: boolean;
}
```

- [ ] **Step 2: Update the auth hook**

Modify `src/lib/hooks/use-auth.ts`:

```typescript
import useSWR from "swr";
import type { AuthMeResponse } from "@/types/auth";
import { fetcher } from "@/lib/fetcher";

export function useAuthUser() {
  const { data, error, isLoading, mutate } = useSWR<AuthMeResponse>(
    "/api/auth/me",
    fetcher,
  );

  return {
    user: data?.user ?? null,
    authMode: data?.authMode ?? "local",
    isAuthDisabled: data?.isAuthDisabled ?? false,
    isLoading,
    error,
    mutate,
  };
}
```

- [ ] **Step 3: Hide account-only menu controls in disabled mode**

Modify `src/components/layout/user-menu.tsx`:

```typescript
  const { user, isAuthDisabled } = useAuthUser();
```

After the `if (!user)` block, add:

```typescript
  if (isAuthDisabled) {
    return null;
  }
```

Keep the existing dropdown for local auth mode.

- [ ] **Step 4: Redirect login page away in disabled mode**

Modify `src/app/login/page.tsx`:

```typescript
  const { user, isLoading, isAuthDisabled } = useAuthUser();
```

At the top of the `useEffect`, add:

```typescript
    if (isAuthDisabled) {
      router.replace("/");
      router.refresh();
      return;
    }
```

Before `if (user)`, add:

```typescript
  if (isAuthDisabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Authentication is disabled. Redirecting...</p>
      </main>
    );
  }
```

- [ ] **Step 5: Redirect register page away in disabled mode**

Modify `src/app/register/page.tsx` to import `useEffect` and `useAuthUser`:

```typescript
import { FormEvent, useEffect, useState } from "react";
import { useAuthUser } from "@/lib/hooks/use-auth";
```

Inside the component, add:

```typescript
  const { isAuthDisabled } = useAuthUser();

  useEffect(() => {
    if (isAuthDisabled) {
      router.replace("/");
      router.refresh();
    }
  }, [isAuthDisabled, router]);

  if (isAuthDisabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Authentication is disabled. Redirecting...</p>
      </main>
    );
  }
```

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/auth.ts src/lib/hooks/use-auth.ts src/components/layout/user-menu.tsx src/app/login/page.tsx src/app/register/page.tsx
git commit -m "feat(auth): hide account UI when auth is disabled"
```

---

### Task 6: Startup Scripts And Documentation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Modify: `docs/getting-started/environment-variables.md`
- Modify: `AGENTS.md`
- Modify: `docs/development/contributing.md`

- [ ] **Step 1: Add cross-env dependency**

Run: `npm install --save-dev cross-env`

Expected: `package.json` and `package-lock.json` update with `cross-env`.

- [ ] **Step 2: Add no-auth npm scripts**

Modify `package.json` scripts:

```json
{
  "dev:no-auth": "cross-env AUTH_MODE=disabled next dev",
  "start:no-auth": "cross-env AUTH_MODE=disabled next start"
}
```

Keep existing scripts unchanged.

- [ ] **Step 3: Document `AUTH_MODE` in `.env.example`**

Add below `AUTH_SECRET`:

```ini
# Authentication mode. Use AUTH_MODE=disabled only for trusted local/single-user deployments.
# AUTH_MODE=local
```

- [ ] **Step 4: Document `AUTH_MODE` in environment variables**

In `docs/getting-started/environment-variables.md`, add to Core Configuration:

```markdown
| `AUTH_MODE` | `string` | No | `local` | Authentication mode. Set to `disabled` only for trusted local or single-user deployments to bypass registration/login. |
```

Add a security note near Security Notes:

```markdown
- `AUTH_MODE=disabled` removes application-level authentication. Use it only behind trusted local access or another access-control layer.
```

- [ ] **Step 5: Document startup commands**

In `AGENTS.md`, under Daily Workflow, add:

```markdown
For trusted single-user/local development without login:

```bash
npm run dev:no-auth
```

For a production build already created with authentication disabled at runtime:

```bash
npm run start:no-auth
```

Do not use disabled auth on an untrusted network unless another access-control layer protects the service.
```

In `docs/development/contributing.md`, add the same command references near local development startup commands.

- [ ] **Step 6: Run docs-relevant checks**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example docs/getting-started/environment-variables.md AGENTS.md docs/development/contributing.md
git commit -m "docs(auth): add no-auth startup mode"
```

---

### Task 7: Final Verification

**Files:**
- Review all modified files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npx vitest run src/lib/auth/mode.test.ts src/lib/auth/middleware-policy.test.ts src/lib/auth/server.test.ts src/app/api/auth/login/route.test.ts src/app/api/auth/register/route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run: `git status --short` and `git diff --stat HEAD`

Expected: Only planned files are modified, or all changes are committed.

- [ ] **Step 5: Manual startup smoke test**

Run: `npm run dev:no-auth`

Expected: Next dev server starts with `AUTH_MODE=disabled`.

Open `/` and `/api/auth/me`.

Expected for `/api/auth/me`:

```json
{
  "user": {
    "id": "anonymous-admin",
    "role": "admin"
  },
  "authMode": "disabled",
  "isAuthDisabled": true
}
```

- [ ] **Step 6: Stop dev server**

Use Ctrl+C or the existing dev stop helper if the server was started through repository scripts.

- [ ] **Step 7: Final handoff**

Summarize:

- What changed.
- Shared contracts: `AUTH_MODE`, `/api/auth/me` response shape, npm scripts.
- Validation commands and observed results.
- Security note that disabled auth is only for trusted local/single-user deployments.
