# Local Keycloak integration

Start: `./scripts/keycloak-local.sh`.

- Application: http://localhost:3200/login
- Identity administration: http://localhost:8280/admin/
- Captured registration/reset emails: http://localhost:8025
- Admin username: admin. Password: KC_ADMIN_PASSWORD in deploy/keycloak/runtime/local.env.

Business data stays in SQLite on its own persistent volume. Keycloak stores its
own schema and credentials in MySQL 8.0 on a different volume. Do not merge the
MySQL business branch to use this setup. No Keycloak source changes are required.

Registration and password recovery happen on Keycloak pages. Passwords require
at least 12 characters. Registration requires clicking the emailed verification
link. Mailpit captures SMTP messages locally and does not deliver to real inboxes.
Logout revokes the application session and redirects to Keycloak's confirmation
page to terminate the browser SSO session. Complete the confirmation to sign out.
Existing local emails are not automatically linked to external identities.

The local applications share a network namespace solely to make the localhost
issuer consistent for browser and server. Production uses stable HTTPS hostnames.
Compose builds with the repository Dockerfile; no private workstation images are required. Local runtime secrets
are ignored by Git and Docker; do not commit or publish them.

Changing the generated realm JSON does not update an already imported realm.
Use the admin console for existing realms; never delete volumes to update production.

Cloud handoff: configure KC_DB=mysql, KC_DB_URL, KC_DB_USERNAME, KC_DB_PASSWORD for
the dedicated MySQL database; use private connectivity and validated TLS appropriate
to the provider. In addition, production needs HTTPS, real SMTP credentials and
sender-domain configuration, backups and production-mode Keycloak. Connecting a
cloud database alone does not configure email delivery or public DNS.

Application interfaces remain /api/auth/oidc/config, /start, /callback,
/api/auth/me and POST /api/auth/logout. Logout may return logoutUrl; Web clients
must navigate there. Never embed the confidential OIDC client secret in an App.
The later business database merge must adapt only the OIDC repository/storage
interface; Keycloak's database and schema remain independently managed by Keycloak.

## Acceptance evidence (2026-11-27)

The real HTTP/SMTP smoke test passed: registration, emailed verification link,
password creation, authenticated application access, reset email, password update,
old-password rejection, new-password login, application logout, Keycloak confirmation
logout, and rejection of legacy credential endpoints in managed mode.
Run `python3 deploy/keycloak/smoke.py` to repeat with a fresh synthetic account.
The test does not use an administrator to mark emails verified.

119 test files / 707 tests passed. Type checking passed. Lint has no errors and
19 existing warnings. Production build and standalone verification passed.
No graphical-browser or native mobile-client acceptance is claimed by these checks.

The database-facing business adapter and schema were not modified. The main integration
contract additions are AUTH_OIDC_PROVIDER, config.managed, and logout.logoutUrl.
Password credentials remain exclusively at Keycloak for newly registered users.
Existing local accounts need an explicit, separately authorized linking procedure;
matching email alone never grants ownership of an existing business account.

The final stack was removed/recreated without deleting volumes. SQLite user IDs
matched exactly before/after, MySQL retained its identity users, and the complete
email registration/reset/logout smoke test passed again after restart.


## Server-side navigation and frontend boundary

In managed mode the request proxy redirects /login and /register to OIDC before
rendering existing frontend pages. No current uncommitted frontend component
changes are needed. Registration selects Keycloak's registrations endpoint.
The existing frontend logout POST + /login navigation is preserved: an HttpOnly,
short-lived marker routes that navigation through provider logout. Callback errors
return a fixed 503 response instead of causing an infinite sign-in redirect loop.
Earlier commits in this branch still contain OneID UI additions and brand renaming;
these are historical changes, not new changes in this integration.

The synthetic SMTP acceptance test refuses to run unless the live realm uses
Mailpit. Never send example.test synthetic recipients through real SMTP.
