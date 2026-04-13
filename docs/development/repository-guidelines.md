# Repository Guidelines

This page is the documentation-site entry for repository development workflow.

The canonical source of truth remains `AGENTS.md` at the repository root in a local clone. Use this page when you are browsing the published docs site, and use `AGENTS.md` when you are working inside the repository itself.

## Source Of Truth

When instructions overlap, use this order:

1. `AGENTS.md` at the repository root
2. `package.json` scripts and `docs/Makefile`
3. `.github/workflows/*.yml`
4. Supporting pages under `docs/development/`

## What This Covers

- Supported local environment
- Repository boundaries for code vs. scratch content
- Validation commands before review
- Collaboration expectations in a shared worktree
- Database migration expectations
- API route responsibilities
- Agent and deep-research development expectations
- Documentation update requirements

## Workflow Overview

```{image} /_static/images/development/workflow-overview-en.png
:alt: English overview of the developer workflow from FigJam
:class: workflow-overview-en
```

```{image} /_static/images/development/workflow-overview-zh.png
:alt: Chinese overview of the developer workflow from FigJam
:class: workflow-overview-zh
```

- [English FigJam Board](https://www.figma.com/board/WFNaqCm92fh8ySjas6txi0/InnoClaw-Developer-Workflow-Overview?node-id=0-1&p=f)
- [Chinese FigJam Board](https://www.figma.com/board/bSNAwMgaZmu4DXZisidzXx/InnoClaw-%E5%BC%80%E5%8F%91%E6%B5%81%E7%A8%8B%E6%A6%82%E8%A7%88?node-id=0-1&p=f)

## Which Guide To Read Next

- Read [Contributing](contributing.md) for the default branch, commit, and PR workflow.
- Read [Collaboration](collaboration.md) before working in a dirty tree, coordinating with another contributor, or handing work to automation.
- Read [Agent Development](agent-development.md) before changing prompts, tools, streaming behavior, deep-research workflow logic, or other agent-facing contracts.

## Next Pages

- [Contributing](contributing.md)
- [Collaboration](collaboration.md)
- [Project Structure](project-structure.md)
- [Local Development](local-development.md)
- [Testing](testing.md)
- [Agent Development](agent-development.md)
- [Documentation Development](documentation.md)
