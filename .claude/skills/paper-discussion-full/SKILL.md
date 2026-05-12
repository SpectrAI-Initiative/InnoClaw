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
- When referencing external work for comparison, cite it using `searchArticles` results.

### Critical Analysis

- Challenge overclaims, weak baselines, missing ablations, and threats to validity.
- Mark issue severity as `Critical`, `Moderate`, or `Minor`.
- When identifying missing baselines or comparing to external methods, cite specific papers found via `searchArticles`.

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

## 8. References

## Quality Rules

- Do not fabricate details not present in the paper context. All external references must come from `searchArticles` results, never from model memory.
- Keep criticism specific and technically grounded.
- Preserve nuance rather than collapsing everything into a single score.
- If paper text cannot be retrieved, state that the report is based on limited context.

## Citation Policy

- Any claim about related work, competing methods, or external benchmarks MUST include a citation retrieved via `searchArticles`. Do NOT cite from memory.
- When the discussion references methods or results not in the seed paper, call `searchArticles` first and cite what is returned.
- If no supporting reference is found, mark the claim: **[Unverified — no supporting reference found via search]**.
- The target paper itself must be cited formally at the top of the report.

### Inline Citation & Reference Format

Use numbered inline citations in the text body (e.g., `[1]`, `[2]`) and collect full references in the `## 8. References` section. All references MUST be rendered in markdown so they are clickable and well-formatted:

**Inline example:**
> 该方法在 ImageNet 上超越了 ViT **[1]**，但在小数据集上的泛化能力受到质疑 **[2]**。

**References section example:**

```
## 8. References

1. **Dosovitskiy, A. et al.** (2021). *An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale.* ICLR 2021. [arXiv:2010.11929](https://arxiv.org/abs/2010.11929)
2. **Liu, Z. et al.** (2021). *Swin Transformer: Hierarchical Vision Transformer using Shifted Windows.* ICCV 2021. [DOI:10.1109/ICCV48922.2021.00986](https://doi.org/10.1109/ICCV48922.2021.00986)
```

- Each reference line MUST include: **Author(s)** (Year). *Title.* Venue/Journal. Linked DOI or URL when available from `searchArticles`.
- Use markdown bold for authors, italic for title, and `[text](url)` for clickable DOI/URL links.
- Number references sequentially as they first appear in the text.
