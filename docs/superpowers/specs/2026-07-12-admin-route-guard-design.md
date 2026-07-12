# Administrator Route Guard Design

## Problem

An ordinary user can register or sign in with `next=/admin/users` and be redirected to the user-management page. The page currently checks only whether authentication is disabled, while middleware checks only whether a session exists. The user-management API correctly rejects non-administrators, but exposing the administrator page shell is confusing and violates the intended privilege boundary.

## Goals

- Redirect authenticated ordinary users away from `/admin/users` before rendering administrator UI.
- Prevent post-login and post-registration redirects from sending ordinary users to any `/admin` route.
- Preserve administrator redirects, CLI browser handoff behavior, existing accounts, sessions, workspaces, and database contents.
- Keep the existing API-level `requireAdmin()` protection unchanged.

## Approaches Considered

1. **Server page guard plus role-aware post-auth redirects (recommended).** Resolve the current authenticated user in the server page and redirect non-administrators home. Add a small pure redirect-policy helper so login and registration reject `/admin` destinations for ordinary users. This prevents both direct navigation and inherited `next` parameters without changing session storage.
2. **Post-auth redirect fix only.** This removes the observed registration path but still lets an ordinary user manually open `/admin/users`, so it does not close the UI authorization gap.
3. **Role-aware middleware.** Persist or resolve the user role in middleware and block all administrator routes there. This broadens the session contract, risks stale role state, and is disproportionate while the server page and API already have access to authoritative role data.

## Design

### Administrator page authorization

`src/app/admin/users/page.tsx` becomes an asynchronous server component. When authentication is enabled, it calls the existing `getAuthContext()` cookie-based lookup. It renders `UserManagementClient` only when the active user role is `admin`; missing sessions and ordinary users are redirected to `/`. Authentication-disabled behavior remains unchanged.

### Role-aware redirect policy

Add a pure helper beside the existing safe internal-path resolver. The helper first applies the current open-redirect checks, then rejects `/admin` and `/admin/*` when the role is `user`, returning the supplied non-admin fallback. Administrators retain the existing behavior.

Both login paths (new credential submission and an already-authenticated/CLI handoff session) and both registration paths (new registration and authenticated CLI handoff) use this helper with the authoritative role available in their response or auth hook.

### Error handling and compatibility

- Unsafe external or malformed `next` values continue to use the existing fallback.
- A user attempting an administrator destination is sent to `/` without an authorization-detail leak.
- Administrator login continues to default to `/admin/users`.
- First-user bootstrap behavior outside strict single-administrator mode remains supported because registration uses the role returned by the server.
- No schema, migration, environment variable, route response, or persisted-session change is required.

## Test Strategy

Use test-driven development with regression tests that fail against the current behavior:

- The administrator page redirects an ordinary user and renders for an administrator.
- The role-aware redirect helper blocks both `/admin` and nested administrator paths for ordinary users while allowing them for administrators.
- Login and registration cannot follow `next=/admin/users` for an ordinary user.
- Existing safe workspace redirects and administrator defaults continue to work.

After focused tests pass, run the repository-required lint, complete test suite, and production build. Deployment verification must exercise a newly registered ordinary user and an administrator separately, without deleting or altering existing user data.
