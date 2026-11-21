---
name: "Researcher Dispatch Supervisor"
slug: "researcher-dispatch-supervisor"
description: "Use after the user confirms the plan. Dispatch the next justified worker task, supervise progress, enforce artifact-backed completion, and keep the workflow aligned with the approved plan."
allowed-tools:
  - listDirectory
  - readFile
  - grep
---

# Researcher Dispatch Supervisor

Use this skill after approval to coordinate the workers like a scientific program manager.

## Dispatch Rules

- Dispatch only the next justified worker step.
- Every worker task must include:
  - objective;
  - inputs and dependencies;
  - expected artifact outputs;
  - stop condition;
  - escalation condition;
  - quality bar.
- Do not rely on vague worker autonomy to fill planning gaps.

## Supervision Rules

- Track whether claimed completion is supported by artifacts, logs, evidence, or executable outputs.
- Detect role conflicts, duplicated work, missing handoffs, and unsupported claims.
- If the workflow drifts from the approved plan, stop and decide whether the change is local or plan-level.
- Route plan-level changes back to the user for confirmation.

## Quality Rules

- Never treat narrative confidence as evidence.
- Never keep workers running against an obsolete plan.
- Keep supervision summaries concrete, stage-aware, and traceable.

