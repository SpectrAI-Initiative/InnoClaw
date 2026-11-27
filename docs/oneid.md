# Innoscale OneID / OIDC integration

## Scope

This branch adds optional OneID browser login through OIDC authorization code +
PKCE S256. The current branch still uses SQLite; no cloud database is accessed.
Local password login and existing session cookies remain compatible. OIDC login
is unavailable when AUTH_MODE=disabled or AUTH_SINGLE_ADMIN=true. Provisioned
OIDC users always receive the user role, even when they are the first user.

The implementation supports two provider shapes:

- Standard OIDC: leave the four `AUTH_OIDC_*_URL` variables empty and the app
  reads `<issuer>/.well-known/openid-configuration`. This also covers a
  self-hosted identity provider if the OneID subscription is not approved.
- Tencent OneID: it publishes no discovery document. Its endpoints are fixed
  paths on the tenant portal host (`sample.portal.tencentciam.com` in the docs):
  `/oauth2/authorize`, `/oauth2/token`, `/oauth2/jwks`, `/userinfo`. Fill in the
  `AUTH_OIDC_*_URL` variables and discovery is skipped entirely.

Checked against the OneID documentation: authorization code plus PKCE with
`code_challenge_method` fixed to `S256`, `scope` fixed to `openid`, ID tokens
signed with RS256, `/oauth2/jwks` returning a standard JWKS, and the profile
read from `/userinfo` rather than from the ID token. OneID documents `state` as
optional; this implementation always requires it.

Still unconfirmed and needing the tenant: whether OneID echoes `nonce` in the ID
token, whether `client_secret` is required for the registered application type
(Web applications require it, the PKCE flow documentation does not mention it),
and the exact `/userinfo` field names and `email_verified` representation. Local
tests model the documented shape only. They do not prove cloud connectivity and
do not create or enable a subscription.

## Configuration after provisioning

Set these server-only variables in the active Docker environment:

```dotenv
AUTH_MODE=local
AUTH_SINGLE_ADMIN=false
AUTH_OIDC_ENABLED=true
AUTH_OIDC_ISSUER=https://YOUR-TENANT-ISSUER
AUTH_OIDC_CLIENT_ID=YOUR-APPLICATION-ID
AUTH_OIDC_CLIENT_SECRET=YOUR-APPLICATION-SECRET
AUTH_OIDC_REDIRECT_URI=https://YOUR-APP-DOMAIN/api/auth/oidc/callback
AUTH_OIDC_ALLOW_HTTP=false
# OneID only: set all three, otherwise leave empty for OIDC discovery.
AUTH_OIDC_AUTHORIZE_URL=https://YOUR-TENANT-PORTAL/oauth2/authorize
AUTH_OIDC_TOKEN_URL=https://YOUR-TENANT-PORTAL/oauth2/token
AUTH_OIDC_JWKS_URL=https://YOUR-TENANT-PORTAL/oauth2/jwks
AUTH_OIDC_USERINFO_URL=https://YOUR-TENANT-PORTAL/userinfo
AUTH_OIDC_SCOPE=openid
AUTH_OIDC_REQUIRE_NONCE=true
AUTH_OIDC_REQUIRE_EMAIL_VERIFIED=true
AUTH_COOKIE_SECURE=true
AUTH_SECRET=YOUR-EXISTING-STRONG-SESSION-SECRET
```

`AUTH_OIDC_ISSUER` is compared byte-for-byte against the `iss` claim, so use the
exact value the tenant publishes. Register the exact callback URL in the OneID
application and enable authorization code with PKCE `S256`.

`AUTH_OIDC_REQUIRE_EMAIL_VERIFIED` defaults to `true`. OneID does not document an
`email_verified` claim, so a real tenant will most likely need it set to `false`.
Understand what that does and does not allow: the identity still has to present a
correctly signed ID token for the configured issuer and audience, and the account
it reaches is still chosen only by the verified `issuer` + `sub` pair. An
unverified email can therefore only create a brand new account with the `user`
role. It can never reach an existing local account, because automatic linking by
matching email stays disabled unconditionally. The residual risk is a person
creating a second account under an email they do not own, so only enable this once
the tenant controls who can register.

`AUTH_OIDC_REQUIRE_NONCE` defaults to `true`. Set it to `false` only if the tenant
proves it does not return `nonce`; when the claim is present it is always checked.
State, the browser-bound binding cookie and the single-use server-side transaction
still apply either way.

No application token or client secret is returned to the browser. Tencent Cloud
root SecretId/SecretKey are not used and must never be entered as OneID
application credentials.

## Questions for Tencent Cloud before the tenant is approved

The subscription is billed per monthly active user on a postpaid basis, but the
public documentation does not list a per-MAU unit price and does not describe
edition tiers, so confirm the following with the account manager rather than
assuming the quoted annual edition is the only option:

1. The per-MAU unit price, the monthly floor and whether a test tenant can be
   opened without a paid subscription.
2. The tenant portal domain and the issuer string that will appear in `iss`.
3. Whether the application can be registered as a confidential Web client, which
   decides if `AUTH_OIDC_CLIENT_SECRET` is required at the token endpoint.
4. Whether the ID token carries `nonce`, `email` and `email_verified`, or whether
   only `/userinfo` supplies them, plus the exact field names.
5. Whether `/userinfo` answers with JSON or with a signed JWT. A signed response
   is not handled by the current code and would need a reviewed change.

Keep AUTH_SECRET stable across app instances. The client secret is included in
the SSM secret lists. Both local and online environment-generation scripts create
disabled placeholders; existing environment files must be updated explicitly.
Do not commit live environment files or secrets. For loopback development only,
AUTH_OIDC_ALLOW_HTTP=true permits HTTP endpoints on localhost/127.0.0.1/::1.

## Routes and behavior

- GET /api/auth/oidc/config: returns only whether the login option is enabled.
- GET /api/auth/oidc/start?next=/: persists a ten-minute transaction and redirects
  to the provider. An HttpOnly SameSite=Lax cookie binds it to the browser.
  When the provider is unusable it returns to /login?oidc_unavailable=1 instead of
  a JSON body, because the entry point is a browser link.
- GET /api/auth/oidc/callback: atomically consumes state, checks PKCE through token
  exchange, verifies JWT signature/issuer/audience/expiry/authorized party, and the
  nonce whenever the provider returns one. When the ID token carries no email the
  profile is read from the userinfo endpoint, whose subject must match the ID token.
  It then resolves the local user and issues the existing application session cookies.

The login/register pages show Continue with OneID only when configured. Return
paths are local and role-aware; CLI handoff returns through the existing login
page. Failure returns a fixed message without leaking provider details or tokens.
Logout uses the existing local session revocation. It does NOT log the user out
of the provider's SSO session; provider-wide logout is intentionally not claimed.
Native App token exchange is not implemented by this browser-cookie flow.

An exact issuer/subject pair maps to one local user. Its SHA-256 digest is the
identity primary key; the original strings are checked on lookup. An existing
local email is never automatically linked. Existing local users should continue
using password login pending an explicit authenticated account-linking feature.
New OIDC-only accounts use a non-password sentinel; verifyPassword rejects it.
No current users, ownership records, roles, or password hashes are rewritten.

## Storage and MySQL integration

SQLite adds migration 0018_oidc_identity and two schema tables. Login state lives
in the database, not process memory, so callbacks are single-use across instances.
Expired state is removed when new logins start. Identity provisioning is atomic.

The MySQL reference branch reviewed was jiabei/mysql at c13508d. It retains users
and user_sessions but removes RETURNING and switches to mysql2. No merge occurred.

For the eventual combined branch:

1. Keep its MySQL connection, schema base, and migration history. Do NOT copy the
   SQLite 0018 migration or SQLite journal over the MySQL history.
2. Append the definitions in docs/oneid/mysql-migration.sql to the MySQL schema
   and generate the next MySQL migration. Preserve utf8mb4_bin and user ID length.
3. Replace repository.ts's SQLite implementation with an export of
   createMysqlOidcRepository(getPool()), importing getPool from @/lib/db and the
   factory from ./mysql-repository. Keep the OidcRepository interface.
4. Run the transaction/identity tests against local Docker MySQL before merging.
   The MySQL adapter uses SELECT FOR UPDATE and transactions rather than RETURNING.
5. Preserve the existing user/session changes from jiabei/mysql. Never migrate or
   test against cdb-5s4eld9c without a separate deployment plan and backups.

## Validation

The colocated flow.test.ts starts an ephemeral local identity server, publishes an
RSA public key and signs test ID tokens. It runs the flow twice: once through OIDC
discovery and once with discovery disabled and explicit OneID-style `/oauth2/*`
endpoints where the email only exists on the userinfo response. It exercises real
token exchange, JWT verification, subject mismatch rejection, the nonce and
verified-email switches, SQLite identity creation and session issuance.
Run with npm test -- src/lib/auth/oidc/flow.test.ts in the local Docker check image.
It requires neither Tencent Cloud keys nor an internet identity provider.

Before enabling OneID for users, verify actual tenant login/registration, email
claims, repeated login, disabled accounts, callback failures, multi-instance
sessions, local logout behavior and application data isolation. Confirm billing
and callback domains separately. No Tencent Cloud purchase is part of this code.
