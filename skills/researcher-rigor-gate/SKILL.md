---
name: "Researcher Rigor Gate"
slug: "researcher-rigor-gate"
description: "Use before plan submission, major plan revision, and major stage transitions. Verify alignment, feasibility, rigor, completeness, and prevent unjustified regressions to earlier workflow phases."
allowed-tools:
  - readFile
  - grep
  - searchArticles
  - readPaper
---

# Researcher Rigor Gate

This skill is the main scientific quality gate for the automated research commander.

## Four Required Checks

### Alignment

- Does the active plan actually match the user’s current confirmed goal?
- Are outdated assumptions or rejected directions still leaking into the workflow?

### Feasibility

- Are assignments compatible with the responsible worker roles?
- Are resources, compute, and time nodes realistic?
- Are dependencies satisfiable in the current state?

### Rigor

- Are baselines, controls, metrics, and validation logic explicit enough to reproduce?
- Are conclusions proportional to the available evidence?

### Completeness

- Are any mandatory stages or handoffs missing?
- Are there unaddressed blockers, contradictions, or risk items?

## Anti-Regression Rule

Do not recommend broad early-stage restarts once the workflow has reached a later phase such as experiment design, implementation, execution, synthesis, or final reporting, unless:

- a specific blocking gap is identified;
- a narrower correction is not sufficient; and
- the change is surfaced to the user as a material workflow revision.

Prefer targeted supplementation over phrases like "go back to round 1 literature search."

