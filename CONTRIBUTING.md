# Contributing to InnoClaw

Thank you for your interest in contributing to InnoClaw!

For detailed contribution guidelines, development setup, and coding conventions, please see:

**[Development Guide](docs/development/contributing.md)**

## Quick Links

- [Local Development](docs/development/local-development.md)
- [Project Structure](docs/development/project-structure.md)
- [Testing](docs/development/testing.md)

For trusted local single-user development without login, see the no-auth startup commands in [Local Development](docs/development/local-development.md).

## Production Build Gate

`npm run build` uses the Webpack production tracer and then runs
`npm run verify:standalone`. The command fails if the standalone artifact is
missing the compiled authentication proxy or contains runtime data, secrets,
backups, repository source, tests, documentation, or local scratch content.
Keep runtime state outside the Docker build context; update the verifier only
when a runtime asset is intentionally shipped.

## Reporting Issues

- **Bugs & Features**: [GitHub Issues](https://github.com/SpectrAI-Initiative/InnoClaw/issues)
- **Security Vulnerabilities**: See [SECURITY.md](SECURITY.md) — do **not** use public issues for security reports.
