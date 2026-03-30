---
name: "Paper Discussion Full"
description: "Use when the user wants the full multi-stage paper discussion workflow, a comprehensive structured discussion of one paper, or an equivalent full-discussion request in another language."
allowed-tools:
  - readPaper
  - searchArticles
---

# Paper Discussion Full

Use this skill when the user wants the full structured discussion workflow for one paper rather than a simple Q&A exchange.

## Goal

Produce a comprehensive, evidence-grounded discussion report for one paper by emulating the full discussion pipeline:

1. Moderator
2. Librarian
3. Skeptic
4. Reproducer
5. Convergence
6. Final Scribe Report

## Workflow

1. Identify the target paper. If it is missing, ask for the title, URL, or PDF link.
2. Use `readPaper` to ground the analysis in the full paper whenever possible.
3. If the user explicitly wants related-work comparison, use `searchArticles` to retrieve nearby papers; otherwise stay tightly focused on the selected paper.
4. Reason through the following stages in order and expose the stage outputs clearly:
   - Agenda
   - Evidence Summary
   - Critical Analysis
   - Reproducibility Check
   - Convergence
   - Final Report
5. Keep every stage grounded in available evidence. When evidence is missing, say so explicitly.

## Stage Expectations

### Agenda

- Define the discussion focus.
- Name the main evaluation axes: novelty, evidence quality, methodology, reproducibility, limitations.

### Evidence Summary

- State the core claim, method, setup, and reported results.
- Separate explicit evidence from inference.

### Critical Analysis

- Challenge overclaims, weak baselines, missing ablations, and threats to validity.
- Mark issue severity as `Critical`, `Moderate`, or `Minor`.

### Reproducibility Check

- Judge whether the paper is easily, partially, or poorly reproducible.
- List what is specified versus what is missing.
- Propose a minimal reproduction recipe.

### Convergence

- Summarize agreement, disagreement, and unresolved questions.

### Final Report

Use this exact structure:

# Paper Discussion Report

## 1. Paper Snapshot
## 2. Key Claims
## 3. Strengths
## 4. Weaknesses / Risks
## 5. Reproducibility Assessment
## 6. Open Questions
## 7. Recommended Next Actions

End with:

`Overall take: ...`

## Quality Rules

- Do not fabricate details not present in the paper context.
- Keep criticism specific and technically grounded.
- Preserve nuance rather than collapsing everything into a single score.
- If paper text cannot be retrieved, state that the report is based on limited context.
