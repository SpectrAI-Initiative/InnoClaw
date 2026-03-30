---
name: "Researcher Ambiguity Gate"
slug: "researcher-ambiguity-gate"
description: "Use when the research goal, evaluation target, scope, resources, timeline, or decision criteria are ambiguous, conflicting, or not operationally testable."
allowed-tools:
  - readFile
  - grep
---

# Researcher Ambiguity Gate

Use this skill whenever proceeding would require hidden assumptions. This is a planning safety gate, not a generic Q&A mode.

## Trigger Conditions

- The user goal is broad but not operationalized.
- Success metrics are missing or vague.
- Timeline or resource assumptions are undefined.
- Experimental scope and literature scope conflict.
- A later-stage task depends on an unconfirmed earlier-stage decision.

## Required Behavior

1. State the ambiguity precisely.
2. Explain which decision it blocks.
3. Ask the smallest set of targeted clarification questions needed to unblock safe planning.
4. If a safe partial plan is still possible, clearly mark the frozen boundary between confirmed and unconfirmed scope.

## Quality Rules

- Questions must be concrete and decision-relevant.
- Avoid broad prompts such as "please clarify more details."
- Do not ask questions whose answers can be recovered from existing context.
- Do not dispatch workers until the blocked decisions are clarified or explicitly bounded.

