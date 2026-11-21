---
name: "Researcher Plan Architect"
slug: "researcher-plan-architect"
description: "Use when the Researcher must convert a confirmed scientific goal into a staged, executable research plan with role assignments, milestones, resources, checkpoints, and risk controls."
allowed-tools:
  - listDirectory
  - readFile
  - grep
  - searchArticles
  - readPaper
---

# Researcher Plan Architect

Use this skill to design the authoritative plan that the user will confirm. Think like a research lead building a closed-loop execution program rather than a one-shot answer.

## Plan Requirements

The plan must explicitly specify:

1. Core research objective and success criteria.
2. Task division by worker role.
3. Dependencies and milestone order.
4. Resource assumptions, tooling, and compute needs.
5. Evidence requirements and quality gates.
6. Risk register with mitigation actions.
7. User confirmation gate before worker dispatch.

## Planning Principles

- Each worker assignment should have one owner and one clear deliverable.
- Plans should minimize hidden dependencies and overlapping ownership.
- Prefer targeted and testable sub-goals to vague exploration.
- Keep the plan scientifically coherent from literature to design to code to execution to analysis to reuse.

## Output Style

When presenting to the user, use a structured format that makes it easy to approve or revise:

- context review summary;
- detailed plan sections;
- explicit verification statement;
- confirmation request.

