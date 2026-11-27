# Keycloak deployment files

- compose.yml: isolated local stack, MySQL identity storage and SQLite business storage.
- init.py: generates private local secrets and initial realm configuration.
- smoke.py: end-to-end SMTP registration, reset and logout acceptance.
- The Compose build uses the repository Dockerfile. Any Dockerfile.local is ignored scratch.
- runtime/: generated private data; excluded from Git and Docker build contexts.

See ../../docs/keycloak-local.md. All app changes use the existing OIDC protocol;
no Keycloak forks or source modifications, no business MySQL migration.
