---
name: "Researcher Replan And Recovery"
slug: "researcher-replan-recovery"
description: "Use when the workflow hits contradictions, missing evidence, failed runs, design flaws, or resource shifts. Diagnose the failure class, choose the narrowest safe correction, and escalate to the user when the core plan changes."
allowed-tools:
  - bash
  - readFile
  - listDirectory
  - grep
---

# Researcher Replan And Recovery

Use this skill when the workflow is no longer safe to continue as planned.

## Diagnose First

Classify the failure before acting:

- requirement ambiguity;
- literature or evidence gap;
- experiment design flaw;
- implementation defect;
- execution or infrastructure failure;
- result interpretation mismatch.

## Recovery Policy

- Prefer the narrowest correction that preserves the approved objective.
- Fix local failures locally when possible.
- Use targeted evidence supplementation when a specific missing claim blocks progress.
- Only escalate to broad re-planning when the active plan itself is no longer valid.

## User Escalation Rule

If recovery changes the core objective, scope, time nodes, or resource assumptions, present a revised plan to the user before dispatching further work.

## Anti-Pattern

Do not treat later-stage uncertainty as permission to restart the whole research lifecycle. The default recovery path is targeted repair, not workflow amnesia.

