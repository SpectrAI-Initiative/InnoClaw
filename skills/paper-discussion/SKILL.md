---
name: "Paper Q&A"
description: "Use when the user wants question-driven help on one paper, including paper understanding, follow-up questions, method or experiment clarification, limitation analysis, or comparison against related work in any language."
allowed-tools:
  - readPaper
  - searchArticles
---

# Paper Q&A

Use this skill for interactive, grounded question answering about a single research paper.

## When To Use

- The user wants to understand one paper more deeply.
- The user asks follow-up questions about motivation, method, experiments, limitations, or implications.
- The user wants a focused comparison between the selected paper and nearby related work.
- The user is asking question-driven help about one paper rather than requesting a full structured discussion pipeline or a batch review.

## Core Workflow

1. Identify the target paper from the user's request.
2. If the paper is not identifiable from the current context, ask for the paper title, URL, or PDF link before continuing.
3. If the question requires more than title or abstract knowledge, use `readPaper` proactively to ground the discussion in the paper text.
4. Use `searchArticles` when the user asks for related work, comparisons, neighboring methods, or follow-up reading, AND whenever you would otherwise cite an external paper from memory.
5. Answer the user's actual question directly instead of dumping a generic summary.

## Discussion Priorities

- Research motivation and problem framing
- Main method and what is actually new
- Experimental setup, datasets, baselines, and metrics
- Strengths, limitations, and threats to validity
- Relationship to prior work
- Practical implications and good next reading directions

## Output Style

- Respond in the user's language unless they explicitly ask otherwise.
- Keep the answer grounded and technical.
- Distinguish clearly between:
  - what the paper explicitly states
  - what is a reasonable inference
  - what is not stated in the available context
- If the user asks an open-ended question, structure the answer with short sections rather than long prose.

## Quality Rules

- Do not invent citations, baselines, implementation details, or results. Any external citation must be retrieved via `searchArticles` — never recalled from memory.
- If the abstract is insufficient, say so and read the paper before making specific claims.
- Do not overstate novelty or significance.
- If the user asks for comparison, name the comparison axis explicitly: method, benchmark, claim, reproducibility, or application scope.

## Citation Policy

- When citing any paper other than the target paper, the citation MUST come from a `searchArticles` call, not model memory.
- If the user asks about related work or comparisons, call `searchArticles` before answering and cite returned results.
- If no reference is found, state: **[Unverified — no supporting reference found via search]** rather than citing from memory.
- When listing references in a structured answer, collect them in a **References** section at the end.

### Inline Citation & Reference Format

Use numbered inline citations in the text body (e.g., `[1]`, `[2]`) and collect full references at the end. All references MUST be rendered in markdown so they are clickable and well-formatted:

**Inline example:**
> Transformer 架构已被广泛应用于蛋白质结构预测 **[1]**，并在 CASP14 中取得突破性成果 **[2]**。

**References section example:**

```
## References

1. **Jumper, J. et al.** (2021). *Highly accurate protein structure prediction with AlphaFold.* Nature, 596, 583–589. [DOI:10.1038/s41586-021-03819-2](https://doi.org/10.1038/s41586-021-03819-2)
2. **Baek, M. et al.** (2021). *Accurate prediction of protein structures and interactions using a three-track neural network.* Science, 373(6557), 871–876. [DOI:10.1126/science.abj8754](https://doi.org/10.1126/science.abj8754)
```

- Each reference line MUST include: **Author(s)** (Year). *Title.* Venue/Journal. Linked DOI or URL when available from `searchArticles`.
- Use markdown bold for authors, italic for title, and `[text](url)` for clickable DOI/URL links.
- Number references sequentially as they first appear in the text.
