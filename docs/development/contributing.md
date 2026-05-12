# Contributing

Thank you for your interest in contributing to InnoClaw! This guide explains how to get involved.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/InnoClaw.git
   cd InnoClaw
   ```
3. **Install** dependencies:
   ```bash
   npm install
   ```
4. Read the repository-level guide in [Repository Guidelines](repository-guidelines.md)
5. Follow the [Installation Guide](../getting-started/installation.md) to set up your development environment

Useful follow-up pages:

- [Collaboration](collaboration.md)
- [Agent Development](agent-development.md)

## Which Guide To Use

- Use [Repository Guidelines](repository-guidelines.md) as the repository-wide source of truth for local workflow, validation, and documentation follow-through.
- Use [Collaboration](collaboration.md) when the worktree is already dirty, when you are coordinating across multiple contributors, or when an automation tool is helping with edits.
- Use [Agent Development](agent-development.md) before changing prompts, tools, agent streaming, deep-research roles, or other agent-facing contracts.

## Contribution Flow

<div class="language-diagram language-diagram-en">

```{mermaid}
flowchart LR
    Start["Start contribution"] --> Branch["Create a focused branch"]
    Branch --> Scope{"Touches shared contracts?"}
    Scope -- "Yes" --> ReadDocs["Read AGENTS.md and matching docs/development pages"]
    Scope -- "No" --> Implement["Implement the change"]
    ReadDocs --> Implement
    Implement --> Docs{"Contributor-facing behavior changed?"}
    Docs -- "Yes" --> UpdateDocs["Update docs and related examples"]
    Docs -- "No" --> Validate["Run lint, test, and build"]
    UpdateDocs --> Validate
    Validate --> Ready{"Checks passed?"}
    Ready -- "No" --> Fix["Fix code, tests, or docs"]
    Fix --> Validate
    Ready -- "Yes" --> PR["Open PR with summary, validation, and contract notes"]
```
</div>

<div class="language-diagram language-diagram-zh">

```{mermaid}
flowchart LR
    Start["开始贡献"] --> Branch["创建聚焦分支"]
    Branch --> Scope{"是否涉及共享契约?"}
    Scope -- "是" --> ReadDocs["阅读 AGENTS.md 与对应 docs/development 页面"]
    Scope -- "否" --> Implement["实现变更"]
    ReadDocs --> Implement
    Implement --> Docs{"面向贡献者的行为是否变更?"}
    Docs -- "是" --> UpdateDocs["更新文档与相关示例"]
    Docs -- "否" --> Validate["运行 lint、test 与 build"]
    UpdateDocs --> Validate
    Validate --> Ready{"检查是否通过?"}
    Ready -- "否" --> Fix["修复代码、测试或文档"]
    Fix --> Validate
    Ready -- "是" --> PR["提交 PR，并附摘要、验证与契约说明"]
```
</div>

Use this flow as the default path for most changes:

1. Start from a focused branch.
2. Detect early whether the change touches contracts such as schema, env vars, route shapes, or agent capabilities.
3. Update documentation in the same change when contributor-facing behavior moves.
4. Only request review after local validation passes.

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
   npm test
   NEXT_TELEMETRY_DISABLED=1 npm run build
   ```
4. **Push** your branch and open a Pull Request
5. **Describe** your changes clearly in the PR description
6. **Wait for review** — maintainers will review your code

If your change updates contributor workflow, environment setup, or developer-facing behavior, update the relevant pages under `docs/development/` in the same PR.

If your change updates agent or deep-research behavior, verify that tool names, privilege boundaries, session persistence, and contributor docs stay aligned.

### PR Checklist

- [ ] Code follows the project's coding style
- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`NEXT_TELEMETRY_DISABLED=1 npm run build`)
- [ ] Documentation updated (if applicable)

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to create a welcoming and inclusive community.

## Reporting Issues

- Use [GitHub Issues](https://github.com/SpectrAI-Initiative/InnoClaw/issues) to report bugs or request features
- Include clear steps to reproduce any bugs
- Provide environment details (OS, Node.js version, browser)
