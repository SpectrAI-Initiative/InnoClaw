---
orphan: true
---

# README Homepage Redesign Plan

## Goal

Turn the repository homepage into a concise English landing page that explains InnoClaw quickly, highlights its strongest workflows, and routes detailed setup and reference material into the existing documentation.

This redesign treats `README.md` as the canonical English homepage and moves translated README files into `docs/README_*.md`.

## Design Principles

- Lead with value before setup details.
- Keep the GitHub homepage skimmable in 2 to 4 minutes.
- Use the docs site for long installation, configuration, troubleshooting, and development content.
- Keep all translated README files structurally aligned with the English homepage.
- Prefer product outcomes and workflows over long internal feature dumps.
- Prefer stable diagrams or workflow visuals over product screenshots when the UI changes quickly.
- Use a consistent emoji system for major headings so sections are easier to scan on GitHub.

## Proposed File Layout

```text
README.md                    # Canonical English homepage
README_en.md                 # Optional short compatibility stub
docs/README_CN.md            # Chinese homepage translation
docs/README_JA.md            # Japanese homepage translation
docs/README_FR.md            # French homepage translation
docs/README_DE.md            # German homepage translation
docs/index.md                # Full documentation portal
```

If a future translation is not ready yet, use a polished placeholder page with links back to the canonical English homepage and docs portal.

## Proposed Homepage Structure

### 1. Hero

Purpose: tell visitors what InnoClaw is in under 10 seconds.

Recommended contents:

- Project name
- Logo plus a stable workflow diagram or product visual
- One-line positioning statement
- Primary badges
- Language links
- Quick links: Docs, Quick Start, Community

Suggested positioning statement:

`A self-hostable AI research workspace for grounded chat, paper study, scientific skills, and research execution.`

Recommended badges:

- License
- Node.js version
- Docs
- GitHub stars or repo link
- Optional: build status

### 2. What Is InnoClaw?

Purpose: give a compact product definition.

Keep this section to 2 or 3 short paragraphs covering:

- Server folders become workspaces
- RAG-grounded chat over local content
- Research-oriented workflows beyond generic chat
- Self-hosted and multi-model friendly deployment

### 3. Why InnoClaw

Purpose: explain why this is not just another general AI chat UI.

Recommended format: 4 to 6 bullets or a compact table.

Suggested pillars:

- Workspace-first research workflow
- Grounded answers with citations
- Paper study, structured discussion, and ideation
- Built-in scientific skills
- Research execution workspace for remote jobs and experiment loops
- Self-hosted deployment with multi-provider support

### 4. Quick Start

Purpose: give the shortest working path.

This should be much shorter than the current README install section. Keep it to:

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
npm install
npm run dev
```

Then add 2 to 4 bullets:

- Open `http://localhost:3000`
- Configure one AI provider in Settings
- Open a workspace and click Sync
- Read the full installation guide in docs

Detailed OS-specific prerequisites should move out of the homepage and remain in `docs/getting-started/installation.md`.

### 5. What You Can Do

Purpose: show practical outcomes instead of implementation details.

Recommended format: short scenario list.

Example scenarios:

- Chat with your research files using RAG-backed citations
- Read and discuss papers with structured multi-agent roles
- Generate summaries, FAQs, briefs, and timelines
- Import scientific skills for domain workflows
- Run remote research jobs with approval gates and monitoring
- Manage multiple agent sessions across projects

### 6. Core Workflows

Purpose: spotlight the product's most differentiated paths.

Recommended subsections:

- Choose Your Path
- How It Fits Together
- Paper Study
- Multi-Agent Discussion
- Research Execution Workspace

Each subsection should contain:

- 1 sentence on what it does
- 3 to 4 concise bullets on how the workflow feels to users

This is also the best place to include one lightweight diagram or sequence block.

Suggested additions:

- `Choose Your Path` should help first-time visitors map their intent to a starting feature.
- `How It Fits Together` should explain the stable product layers without relying on UI screenshots.
- Key workflow subsections can also use stable emoji markers, for example paper study, discussion, and execution.

### 7. Feature Snapshot

Purpose: provide a compact capability inventory without becoming a full manual.

Recommended format: table with 8 to 10 rows max.

Example columns:

| Feature | What it enables |
|---------|------------------|
| Workspace Management | Map server folders into persistent AI workspaces |
| RAG Chat | Grounded answers over indexed files with citations |
| Paper Study | Search, summarize, and explore papers in one place |
| Discussion Mode | Multi-role paper review with structured stages |
| Research Ideation | Generate new directions from existing papers |
| Skills System | Import reusable workflows and domain capabilities |
| Research Execution | Orchestrate remote experiment loops with approvals |
| Multi-LLM | OpenAI, Anthropic, Gemini, and compatible endpoints |
| Bot Integration | Feishu and other notification or bot workflows |

### 8. Documentation

Purpose: route users to the right depth quickly.

Recommended grouping:

- Start here: Overview, Installation
- Configure and deploy: Deployment, Environment Variables, Configuration
- Use the product: Features, API Reference
- Troubleshoot and contribute: Troubleshooting, Development Guide

Link these to the existing documentation tree instead of duplicating the content in the homepage.

### 9. Community

Purpose: create trust and a feedback path.

Recommended contents:

- Docs site link for setup and usage help
- GitHub Issues link for bugs and feature requests
- Feishu group or community channel for direct discussion

### 10. Footer Sections

Keep these short:

- Project info block with license, repository, and docs links
- Citation if needed
- Star History

## What Should Move Out of the Homepage

The following content is valuable, but better suited to docs pages or translated readmes:

- Long OS-by-OS dependency setup from the current Quick Start section
- Full Skills import walkthrough
- Full Feishu bot setup walkthrough
- Full Kubernetes setup walkthrough
- Long environment variable reference
- Long troubleshooting list
- Detailed project structure and development commands

## Current-to-New Content Mapping

### Current English README Material

- Keep and rewrite the top-level description from `README_en.md`
- Shorten `What's New` to the latest 2 or 3 items, or move it below the hero
- Compress the long `Overview` list into `Why InnoClaw`
- Replace the current long `Quick Start` with a short path plus docs link
- Move most of `Setup Advanced Features via Skills` into docs links
- Compress `Features` into `Feature Snapshot`
- Replace long `Usage Guide` with docs links
- Keep `Star History` at the bottom

### Current Chinese README Material

- Move the current Chinese homepage content from `README.md` into `docs/README_CN.md`
- Keep the same section order as the English homepage
- Add a note that the English homepage in `README.md` is the canonical version

## Translation Strategy

Use one structure for all README translations:

1. Hero
2. What Is InnoClaw?
3. Why InnoClaw
4. Quick Start
5. What You Can Do
6. Core Workflows
7. Feature Snapshot
8. Documentation
9. Community
10. License

Recommended note near the top of translated files:

`This translation may lag behind the English homepage in README.md.`

## Suggested Migration Steps

1. Rewrite `README.md` into the new English homepage.
2. Move the current Chinese homepage into `docs/README_CN.md`.
3. Add or migrate other translations into `docs/README_*.md`.
4. Convert `README_en.md` into a short compatibility stub or remove it later.
5. Replace long setup and reference sections in the homepage with docs links.
6. Add one stable workflow diagram or low-maintenance visual near the top.
7. Verify all language links and docs links resolve correctly.

## Suggested README Skeleton

```md
# InnoClaw

<hero image>

One-line positioning statement.

[Badges]

English | [Chinese](docs/README_CN.md) | [Japanese](docs/README_JA.md) | [French](docs/README_FR.md) | [German](docs/README_DE.md)

[Documentation](https://SpectrAI-Initiative.github.io/InnoClaw/) | [Quick Start](#quick-start) | [Community](#community)

---

## What Is InnoClaw?

Short product description.

## Why InnoClaw

- Key differentiator 1
- Key differentiator 2
- Key differentiator 3
- Key differentiator 4

## Quick Start

```bash
git clone https://github.com/SpectrAI-Initiative/InnoClaw.git
cd InnoClaw
npm install
npm run dev
```

- Open `http://localhost:3000`
- Configure one provider in Settings
- Open a workspace and click Sync
- See the full install guide in docs

## What You Can Do

- Outcome 1
- Outcome 2
- Outcome 3
- Outcome 4

## Core Workflows

### Paper Study

Short description.

### Multi-Agent Discussion

Short description.

### Research Execution Workspace

Short description.

## Feature Snapshot

| Feature | What it enables |
|---------|------------------|
| ... | ... |

## Documentation

- [Overview](../getting-started/overview.md)
- [Installation](../getting-started/installation.md)
- [Deployment](../getting-started/deployment.md)
- [Environment Variables](../getting-started/environment-variables.md)
- [Features](../usage/features.md)
- [Configuration](../usage/configuration.md)
- [API Reference](../usage/api-reference.md)
- [Troubleshooting](../troubleshooting/faq.md)
- [Development Guide](../development/contributing.md)

## Community

Community and support links.

## License

MIT

## Star History

<star history image>
```

## Success Criteria

The redesign is successful if:

- A new visitor understands the product within 15 to 20 seconds.
- Quick Start appears before any long setup details.
- The homepage highlights research workflows, not just a feature dump.
- The docs site becomes the place for long-form setup and reference material.
- All translations follow the same structure and are easy to maintain.
