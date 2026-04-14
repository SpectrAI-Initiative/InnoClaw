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
  - supporting references (at least 1 per hypothesis, retrieved via `searchArticles`)

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
  - key references (cite the source for each baseline method and any adopted protocol, retrieved via `searchArticles`)

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
## 7. References

## Quality Rules

- Ground every idea in the seed paper or cited external evidence retrieved via `searchArticles`. Model-memory citations are forbidden.
- Mark speculation explicitly when it goes beyond the paper.
- Prefer testable and executable ideas over vague ambition.
- If paper text is unavailable, say that the ideation is based on limited context.

## Citation Policy

- Every hypothesis rationale, related-work claim, baseline reference, and methodology mention MUST include a citation retrieved via `searchArticles`. Do NOT cite from memory.
- Use `searchArticles` proactively at the start of each hypothesis to locate supporting and contrasting literature before writing the rationale.
- If `searchArticles` returns no relevant result for a claim, mark the claim explicitly as: **[Unverified — no supporting reference found via search]**.
- Do not silently drop unreferenced claims; either find a reference or flag it.
- The seed paper itself must also be cited formally using the same format.

### Inline Citation & Reference Format

Use numbered inline citations in the text body (e.g., `[1]`, `[2]`) and collect full references in the `## 7. References` section. All references MUST be rendered in markdown so they are clickable and well-formatted:

**Inline example:**
> 近期研究表明，基于扩散模型的分子生成方法在 drug-likeness 指标上显著优于传统 VAE 方法 **[1]**，同时在合成可达性方面也有改善 **[2]**。

**References section example:**

```
## 7. References

1. **Xu, M. et al.** (2022). *GeoDiff: A Geometric Diffusion Model for Molecular Conformation Generation.* ICLR 2022. [arXiv:2203.02923](https://arxiv.org/abs/2203.02923)
2. **Hoogeboom, E. et al.** (2022). *Equivariant Diffusion for Molecule Generation in 3D.* ICML 2022. [arXiv:2203.17003](https://arxiv.org/abs/2203.17003)
```

- Each reference line MUST include: **Author(s)** (Year). *Title.* Venue/Journal. Linked DOI or URL when available from `searchArticles`.
- Use markdown bold for authors, italic for title, and `[text](url)` for clickable DOI/URL links.
- Number references sequentially as they first appear in the text.
