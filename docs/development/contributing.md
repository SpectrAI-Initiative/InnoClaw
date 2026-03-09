# Contributing

Thank you for your interest in contributing to VibeLab! This guide explains how to get involved.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/notebooklm.git
   cd notebooklm
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. Follow the [Installation Guide](../getting-started/installation.md) to set up your development environment

## Branching Strategy

- `main` — Stable production branch
- Feature branches — Created from `main` for new features or bug fixes

### Branch Naming Convention

```
feature/short-description
fix/issue-number-description
docs/what-is-changing
```

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

### Commit Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, no logic change) |
| `refactor` | Code refactoring (no feature or fix) |
| `test` | Adding or updating tests |
| `chore` | Build process or auxiliary tool changes |

### Examples

```
feat(chat): add streaming response indicator
fix(files): handle special characters in filenames
docs(api): update endpoint documentation
```

## Pull Request Process

1. **Create a branch** from `main` with a descriptive name
2. **Make your changes** and commit with conventional commit messages
3. **Run checks** before submitting:
   ```bash
   npm run lint
   npm run build
   npm test
   ```
4. **Push** your branch and open a Pull Request
5. **Describe** your changes clearly in the PR description
6. **Wait for review** — maintainers will review your code

### PR Checklist

- [ ] Code follows the project's coding style
- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if applicable)

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to create a welcoming and inclusive community.

## Reporting Issues

- Use [GitHub Issues](https://github.com/zjowowen/notebooklm/issues) to report bugs or request features (when enabled)
- Include clear steps to reproduce any bugs
- Provide environment details (OS, Node.js version, browser)
