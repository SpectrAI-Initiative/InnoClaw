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
4. Use `searchArticles` only when the user asks for related work, comparisons, neighboring methods, or follow-up reading.
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

- Do not invent citations, baselines, implementation details, or results.
- If the abstract is insufficient, say so and read the paper before making specific claims.
- Do not overstate novelty or significance.
- If the user asks for comparison, name the comparison axis explicitly: method, benchmark, claim, reproducibility, or application scope.
