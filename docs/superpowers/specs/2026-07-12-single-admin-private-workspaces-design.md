# Single-Administrator Authentication and Private Workspaces Design

## Goal

Replace the deployment's shared Nginx Basic Auth and disabled application authentication with InnoClaw local accounts. The deployment has exactly one administrator, permits public self-registration only as ordinary users, and gives each ordinary user a private workspace area while allowing the administrator to manage all users and workspaces.

The current deployment remains on public HTTP port 80 temporarily. The design therefore makes insecure-cookie operation an explicit, reversible deployment choice without weakening the production default.

## Confirmed Product Decisions

- Remove Nginx Basic Auth after application-level authentication passes verification.
- Use InnoClaw email-and-password local accounts.
- Enforce one administrator when single-administrator policy is enabled.
- Bootstrap the administrator before removing the existing outer gate.
- Bootstrap identity:
  - email: `admin@innoclaw.local`
  - display name: `Administrator`
  - password: generated during deployment and delivered out of band
- Keep public self-registration. Every public registration creates an ordinary user.
- Let ordinary users create private workspaces. They cannot list, browse, register, or operate another user's workspace.
- Let the administrator list and manage all users and workspaces.
- Continue serving the application through Nginx on public port 80 for now.

## Scope

This change covers:

- single-administrator policy and administrator bootstrap;
- local-auth session cookies over an explicitly configured HTTP deployment;
- public ordinary-user registration;
- user-management API and UI behavior;
- administrator-wide ownership access;
- per-user workspace roots and first-workspace creation;
- canonical path validation and cross-user isolation;
- deployment rate limiting, validation, and rollback;
- documentation for the new configuration contracts.

This change does not add HTTPS, email verification, invitation codes, CAPTCHA, per-user storage quotas, per-user model quotas, billing, or an external identity provider. Because registration is public, anyone who can reach the URL can create an ordinary account and consume resources available to ordinary users. Nginx rate limiting reduces burst abuse but is not identity verification or a quota system.

The OpenAI-compatible model and reasoning-effort implementation is specified separately in `docs/superpowers/specs/2026-07-12-openai-reasoning-effort-design.md`. Both changes are deployed and verified together, but their code contracts remain separate.

## Approaches Considered

### 1. Deployment configuration only

Switching to local auth, seeding a user, and removing Basic Auth would be fast, but the current admin API can create or promote additional administrators. It also leaves the circular first-workspace authorization failure and does not provide per-user filesystem roots. This approach does not meet the requirements.

### 2. Application-enforced policy and workspace isolation

Add explicit authentication policy, a one-time bootstrap command, server-side role invariants, role-aware workspace roots, and path authorization. Keep the existing local account and SQLite architecture. This is the selected approach because it satisfies the requirements with focused changes and preserves current application boundaries.

### 3. External identity and storage gateways

An external IdP and a separate storage authorization layer could provide enterprise controls, but they would add multiple services and substantial operational work. They are unnecessary for this deployment.

## Configuration Contract

The deployment uses:

- `AUTH_MODE=local`
- `AUTH_SINGLE_ADMIN=true`
- a strong random `AUTH_SECRET`
- `AUTH_COOKIE_SECURE=false` while the public endpoint is HTTP
- `WORKSPACE_ROOTS=/research`

`AUTH_SINGLE_ADMIN` is optional and defaults to `false` so existing multi-admin installations retain their current behavior. It accepts explicit boolean values. An invalid non-empty value produces a configuration error instead of silently changing authorization behavior.

`AUTH_COOKIE_SECURE` is optional. When unset, cookies remain secure in production and insecure in development, preserving current behavior. Explicit `true` or `false` overrides that default. Invalid values fail explicitly. The target deployment uses `false` only until HTTPS is enabled; changing to HTTPS requires setting it to `true` or removing the override.

`WORKSPACE_ROOTS` must contain at least one existing absolute directory when per-user local accounts are used. The deployment's container root remains `/research`, backed by the existing host workspace volume.

## Authentication Architecture

### Central policy module

A focused server-side auth policy module owns parsing and enforcement of single-administrator mode. Route handlers call this module instead of duplicating environment checks or role rules.

When `AUTH_SINGLE_ADMIN=true`:

- the public registration route always writes `role: "user"`, including when the user table is otherwise empty;
- the admin user-creation route only creates ordinary users and rejects a supplied admin role;
- role-changing requests are rejected;
- the administrator cannot be demoted, disabled, or deleted;
- the UI does not expose role mutation controls;
- zero or multiple administrator rows, or a sole inactive administrator, is reported as an invalid deployment state rather than repaired silently.

When the policy is disabled, existing role-management behavior remains available for other deployments.

### Administrator bootstrap

Add an operator-only CLI command that uses the same password hashing and database helpers as the application. It accepts email and display name as arguments and reads the password from standard input. It never prints the password or password hash.

The command behaves as follows:

1. If no administrator row exists, create the requested active administrator.
2. If that same active administrator already exists, exit successfully without changing its password.
3. If that administrator exists but is inactive, refuse with an explicit recovery error rather than reactivating it silently.
4. If a different administrator exists, refuse to create another one.
5. If the requested email already belongs to an ordinary user, refuse to promote or overwrite it.

This makes deployment retry-safe without creating a hidden password-reset path.

### Session cookies

All session-cookie creation and clearing uses one shared cookie-options helper. The helper applies `AUTH_COOKIE_SECURE` consistently to the session token, expiry, and signature cookies. Cookies remain `HttpOnly`, `SameSite=Lax`, path-scoped to `/`, and signed with `AUTH_SECRET`.

HTTP mode protects neither login credentials nor cookies from network interception. The configuration and documentation must state that it is temporary and that Basic Auth over HTTP would not provide transport encryption either.

## Registration and User Management

The public registration form remains available. It collects name, email, and password, but it does not send or display a role choice. The registration API does not silently ignore a role: if a role is supplied in single-administrator mode, it rejects the request so callers cannot mistake the field for supported behavior.

Unless single-administrator mode has exactly one active administrator row, registration returns HTTP 503 with a setup-incomplete or policy-state error. This fails closed until bootstrap finishes. Privileged management operations also return HTTP 503 and record a redacted policy error; they do not reactivate, choose, or demote an administrator automatically.

The admin user-management page:

- creates ordinary users only;
- shows roles as immutable badges;
- lets the administrator rename, disable, delete, and reset passwords for ordinary users;
- prevents disabling, deleting, or demoting the administrator;
- permits the administrator to change their own name or password.

Password reset and account deactivation revoke the target user's current sessions. API checks remain authoritative even if a caller bypasses the UI.

Expected error statuses are:

- 400 for malformed input or unsupported role mutation;
- 401 for missing or invalid authentication;
- 403 for authenticated access outside the caller's privilege or ownership boundary;
- 409 for duplicate email, workspace path, or other ownership conflicts;
- 429 for Nginx rate limiting;
- 503 for an invalid single-administrator bootstrap state.

Passwords, cookies, session tokens, API keys, and password hashes must not appear in application, deployment, or test output.

## Workspace Isolation Architecture

### Effective roots

`WORKSPACE_ROOTS` remains the operator-approved filesystem boundary. For each configured root, an ordinary user's effective root is derived from the immutable database user ID:

`<configured-root>/users/<user-id>`

For the target deployment this is `/research/users/<user-id>`. The directory is provisioned lazily and idempotently when the authenticated user first opens the workspace creation flow. The UI receives only that user's effective roots and starts from the first one. It no longer falls back to `/nonexistent/Desktop`.

The administrator receives the configured operator roots and can list all workspace rows. Ordinary users receive only workspace rows whose `ownerUserId` matches their authenticated user ID.

### Separate provisioning and workspace capabilities

The authorization layer exposes two distinct capabilities:

1. **Workspace provisioning access** permits directory browsing, directory creation, and workspace registration inside an effective root. Administrators use configured operator roots; ordinary users use their derived per-user roots.
2. **Registered workspace access** permits normal file, note, source, chat, research, and tool operations only inside a workspace visible to the caller.

This separation fixes the current circular dependency in which browsing or creating the directory for a first workspace requires an already registered workspace. It avoids granting ordinary users access to the shared `/research` parent.

### Path and ownership validation

All provisioning and workspace-registration requests are validated on the server before `addWorkspaceRoot`, database mutation, or filesystem mutation.

Validation must:

- require an absolute path under the caller's allowed root;
- normalize separators and `.`/`..` segments;
- reject null bytes;
- resolve existing paths through `realpath`;
- resolve the nearest existing parent for a path being created;
- reject symbolic-link traversal that escapes the allowed root;
- store a canonical absolute workspace path;
- reject registration of a path already owned by another account.

Add a unique database index for canonical `workspaces.folderPath` values so concurrent requests cannot register one directory twice. Before applying the index, a preflight command resolves every existing workspace path. If canonical paths collide, deployment stops with an explicit list of affected workspace IDs. Otherwise it rewrites the paths to their canonical values in one transaction and then applies the unique index. It never deletes or reassigns data automatically.

Deleting an ordinary user retains the existing transfer behavior: database ownership moves to the administrator and disk files remain intact. Because the administrator can access all configured roots, transferred workspaces remain usable even if their physical directory remains under the deleted user's ID.

## Nginx and Public Exposure

Nginx continues to listen on public port 80 and proxy only to the application bound on `127.0.0.1:3000`. The existing `auth_basic` directives are removed only after application-level smoke tests pass.

Add per-IP request limits for the authentication endpoints: login allows 10 requests per minute with a burst of 10, and registration allows 1 request per minute with a burst of 2. Nginx uses status 429 for rejected requests and continues to forward the original host, scheme, and client address. These limits are operational protection only; they do not replace HTTPS, account quotas, or abuse monitoring.

## Model Configuration Coordination

The same release configures the already approved OpenAI-compatible provider contract:

- `LLM_PROVIDER=openai`
- `LLM_MODEL=gpt-5.6-sol`
- `OPENAI_BASE_URL=http://47.88.18.125:8080/v1`
- `OPENAI_REASONING_EFFORT=ultra`, normalized inside InnoClaw to upstream-supported `xhigh`

The API key remains only in the root-readable remote environment file. It is never committed or echoed during verification.

## Testing

Focused automated coverage includes:

- strict boolean parsing for the two new auth environment variables;
- default secure-cookie behavior and explicit HTTP override for every auth cookie;
- public registration always creating an ordinary user in single-admin mode;
- registration returning 503 before bootstrap;
- bootstrap creation, same-admin idempotence, and second-admin rejection;
- admin API allow and deny paths for create, role change, disable, delete, and password reset;
- role selectors being absent from the single-admin UI;
- administrator visibility of all workspaces and ordinary-user ownership filtering;
- effective root derivation and lazy provisioning;
- first-workspace browse, mkdir, and registration;
- user A being unable to list, browse, register, or mutate user B's workspace;
- administrator access to both users' workspaces;
- traversal, null-byte, symlink-escape, duplicate-path, and concurrent-registration rejection;
- existing disabled-auth and non-single-admin behavior remaining unchanged where configured.

Repository verification runs:

```bash
npm run lint
npm test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

The reasoning-effort tests and verification defined in the separate model design are also required before deployment.

## Deployment Sequence

1. Record the current image identifier and back up the SQLite database, `.env.production.local`, and Nginx site configuration with root-only permissions.
2. Confirm there are no duplicate canonical workspace paths and that the configured root exists and is writable by the container.
3. Keep Nginx Basic Auth enabled while deploying the new image and applying database migrations.
4. Configure local auth, single-administrator mode, the temporary HTTP cookie override, a random auth secret, workspace roots, and the model provider values.
5. Generate a strong administrator password, pipe it to the bootstrap command, and deliver it to the operator without logging it.
6. Verify through the protected endpoint that the administrator can log in, public registration creates only ordinary users, two temporary users are isolated, the administrator sees both workspaces, and unauthorized paths return 403.
7. Send a real authenticated InnoClaw request through `openai/gpt-5.6-sol`; verify successful output and no provider-option error. The direct upstream compatibility baseline remains literal `ultra` rejected and `xhigh` accepted.
8. Remove Nginx Basic Auth, reload Nginx, and verify from the public URL that unauthenticated access reaches InnoClaw login, administrator login works, self-registration works, and port 80 remains the only public application port.
9. Remove temporary smoke-test users and data, while retaining validation evidence without secrets.

## Rollback

Until all public smoke tests pass, retain the previous image and backups. If migration, login, workspace isolation, or inference verification fails:

1. restore the prior Nginx configuration so the outer gate remains active;
2. restore the previous environment and database backup if a migration was applied;
3. recreate the previous container image;
4. confirm the old health endpoint and protected public page respond before ending rollback.

The generated administrator password must be invalidated or securely discarded if the database containing that account is rolled back.

## Acceptance Criteria

- `http://106.75.210.30` opens the InnoClaw login page without a browser Basic Auth prompt.
- `admin@innoclaw.local` is the only administrator and can log in with the delivered generated password.
- Public registration creates only ordinary users and cannot influence role assignment.
- No UI or API path can create, promote, disable, demote, or delete a second or sole administrator while single-administrator mode is enabled.
- Each ordinary user can create a first workspace under their private root without administrator intervention.
- Ordinary users cannot observe or operate another user's workspace paths or records.
- The administrator can view and manage all users and workspaces.
- Session cookies work on the explicitly configured HTTP deployment and can return to secure defaults for HTTPS.
- Auth endpoints are rate-limited and sensitive values do not appear in logs.
- InnoClaw successfully invokes `gpt-5.6-sol` with operator value `ultra` normalized to upstream `xhigh`.
- Lint, tests, production build, migration, public smoke tests, and rollback readiness all pass.
