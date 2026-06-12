# Auth Disabled Mode Design

## Context

Users want a supported startup path for running InnoClaw without account registration or login. The current app enforces authentication in two places:

- `middleware.ts` checks signed session cookies and redirects unauthenticated page requests to `/login`.
- API routes call shared helpers such as `requireAuth`, `requireAdmin`, and `requireWorkspaceAccess`.

The existing ownership and admin checks are shared contracts. The no-login mode should preserve those call sites instead of requiring every route to learn about a second authorization model.

## Decision

Add an explicit environment-driven auth mode:

- Default mode remains unchanged and requires normal registration/login.
- `AUTH_MODE=disabled` disables the login requirement for trusted single-user deployments.
- Convenience startup scripts set `AUTH_MODE=disabled` for users who want an obvious no-auth launch command.

When auth is disabled, the server returns a fixed anonymous admin context:

- `id`: `anonymous-admin`
- `email`: `anonymous@local`
- `name`: `Anonymous Admin`
- `role`: `admin`
- `isActive`: `true`

Using an admin-shaped context keeps existing route-level checks, settings access, workspace access, and admin-required APIs functional without weakening each individual route by hand.

## Data Flow

1. Startup config sets `AUTH_MODE=disabled`.
2. `middleware.ts` detects disabled auth and allows all matching page/API requests through.
3. `getAuthContext` returns the anonymous admin context even without cookies.
4. `requireAuth` and `requireAdmin` continue to work through the existing helper API.
5. `/api/auth/me` returns the anonymous user and a non-persistent session descriptor.
6. Client hooks continue to use `/api/auth/me`; UI can hide account-only controls when auth is disabled.

## UI Behavior

When auth is disabled:

- The app should not redirect to `/login`.
- The header should not show user management or sign-out controls.
- `/login` and `/register` should not create a session or real user. They may redirect to `/` or show a clear disabled-auth state.

## Errors And Security Notes

This mode removes authentication and should be documented as suitable only for local or trusted-network deployments. It is not a multi-user access-control mechanism.

Login/register API endpoints should return a clear `403` or similar non-success response when auth is disabled, so automation cannot accidentally create accounts in this mode.

## Documentation

Update:

- `.env.example`
- `docs/getting-started/environment-variables.md`
- contributor-facing workflow docs if new `package.json` scripts are added.

## Testing

Add focused tests for:

- Auth mode parsing/default behavior.
- `getAuthContext`/`requireAuth` returning anonymous admin in disabled mode.
- Middleware bypassing auth checks in disabled mode.
- Login/register endpoints rejecting account operations in disabled mode where practical.

Run at least:

- Targeted Vitest files for new auth-mode behavior.
- `npx tsc --noEmit`

Run broader validation if changes touch shared route behavior beyond the planned helpers.
