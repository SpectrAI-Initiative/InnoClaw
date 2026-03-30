---
name: "Research Ideation Full"
description: "Use when the user wants the full research ideation workflow grounded in one seed paper, including complete ideation, feasibility review, experiment planning, and final synthesis, or makes an equivalent ideation request in another language."
allowed-tools:
  - readPaper
  - searchArticles
---

# Research Ideation Full

Use this skill when the user wants a full ideation pipeline grounded in one seed paper, not just a few brainstorming bullets.

## Goal

Turn one seed paper into a structured research ideation report by emulating the five-stage ideation workflow:

1. Hypothesis Generation
2. Feasibility Review
3. Experiment Design
4. Review
5. Final Synthesis

## Workflow

1. Identify the seed paper. If the paper is not identifiable, ask for the title, URL, or PDF link.
2. Use `readPaper` to ground the ideation in the full paper whenever possible.
3. If the user provided a seed idea or direction, incorporate it explicitly into the ideation process.
4. Use `searchArticles` when you need related work, benchmarks, datasets, or neighboring methods to assess novelty or feasibility.
5. Run the stages in order and make the stage boundaries visible in the answer.

## Stage Expectations

### Hypothesis Generation

- Generate `3-5` concrete, testable hypotheses.
- For each hypothesis include:
  - statement
  - rationale
  - novelty
  - connection to the seed paper
  - estimated impact

### Feasibility Review

- For each hypothesis assess:
  - data availability
  - compute requirements
  - methodological readiness
  - timeline
  - key risks
- Rate each one:
  - `Highly Feasible`
  - `Feasible with Effort`
  - `Challenging`
  - `Infeasible`

### Experiment Design

- Select the top `2` most promising and feasible hypotheses.
- For each one provide:
  - protocol
  - baselines
  - controls and ablations
  - metrics
  - expected outcomes
  - minimum viable experiment
  - timeline

### Review

- Critique the full plan for logical gaps, ethical concerns, statistical issues, missing baselines, and scope problems.
- For each criticism, propose a concrete improvement.

### Final Report

Use this exact structure:

# Research Ideation Report

## 1. Paper Snapshot
## 2. Generated Hypotheses
## 3. Experiment Plans
## 4. Review Findings
## 5. Recommended Actions
## 6. Overall Assessment

## Quality Rules

- Ground every idea in the seed paper or clearly labeled external evidence.
- Mark speculation explicitly when it goes beyond the paper.
- Prefer testable and executable ideas over vague ambition.
- If paper text is unavailable, say that the ideation is based on limited context.
